import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const REQUEST_ID_HEADERS = [
    'x-request-id',
    'x-openai-request-id',
    'openai-request-id',
    'cf-ray',
    'x-amzn-requestid'
];
export const SCORING_RUBRIC = [
    { code: 'model_mismatch', category: 'model', score: 30, severity: 'high', description: 'Response model differs from requested model.' },
    { code: 'base_url_embedded_credentials', category: 'privacy', score: 30, severity: 'high', description: 'base_url contained username or password material.' },
    { code: 'base_url_invalid', category: 'configuration', score: 30, severity: 'high', description: 'base_url is not a valid URL.' },
    { code: 'stream_malformed_chunks', category: 'stream', score: 25, severity: 'high', description: 'Stream contained malformed SSE JSON chunks.' },
    { code: 'stream_no_chunks', category: 'stream', score: 25, severity: 'high', description: 'Stream completed without valid chunks.' },
    { code: 'usage_missing', category: 'usage', score: 20, severity: 'medium', description: 'Non-stream response did not include usage.' },
    { code: 'base_url_not_https', category: 'privacy', score: 20, severity: 'high', description: 'Remote base_url does not use HTTPS.' },
    { code: 'response_model_missing', category: 'model', score: 15, severity: 'medium', description: 'Response did not include a model field.' },
    { code: 'usage_token_fields_invalid', category: 'usage', score: 15, severity: 'medium', description: 'Usage token fields are missing, negative, or non-integer.' },
    { code: 'usage_total_inconsistent', category: 'usage', score: 15, severity: 'medium', description: 'Usage total does not match prompt plus completion tokens.' },
    { code: 'latency_very_high', category: 'latency', score: 15, severity: 'medium', description: 'Request latency exceeded 30 seconds.' },
    { code: 'base_url_query_present', category: 'privacy', score: 10, severity: 'medium', description: 'base_url contained query parameters.' },
    { code: 'response_id_missing', category: 'transparency', score: 10, severity: 'medium', description: 'Response id is missing.' },
    { code: 'system_fingerprint_missing', category: 'transparency', score: 5, severity: 'info', description: 'system_fingerprint is missing.' },
    { code: 'request_id_header_missing', category: 'transparency', score: 5, severity: 'info', description: 'No recognizable request id header was returned.' },
    { code: 'latency_high', category: 'latency', score: 5, severity: 'low', description: 'Request latency exceeded 10 seconds.' },
    { code: 'third_party_gateway', category: 'privacy', score: 0, severity: 'info', description: 'Third-party gateway review reminder.' }
];
const FINDING_GUIDANCE = {
    model_mismatch: {
        riskReason: 'A model field mismatch is direct transparency evidence that the gateway returned metadata different from the request.',
        recommendedAction: 'Repeat the audit with stream and non-stream modes, then ask the gateway operator to explain routing and model alias behavior.',
        falsePositiveNotes: 'Some gateways intentionally map aliases to canonical model names; verify whether the provider documents that mapping.'
    },
    base_url_invalid: {
        riskReason: 'An invalid URL prevents a reliable audit target from being identified.',
        recommendedAction: 'Correct the base_url and rerun the audit.',
        falsePositiveNotes: 'Shell quoting mistakes can produce invalid URLs.'
    },
    base_url_not_https: {
        riskReason: 'HTTP can expose prompts, metadata, and authorization headers on the network path.',
        recommendedAction: 'Use HTTPS for remote gateways, or restrict testing to trusted local development endpoints.',
        falsePositiveNotes: 'Localhost and 127.0.0.1 are treated as development endpoints and are not scored here.'
    },
    base_url_embedded_credentials: {
        riskReason: 'Credentials embedded in URLs are easy to leak through shell history, logs, screenshots, and reports.',
        recommendedAction: 'Move secrets to environment variables and rotate any credential that may have been exposed.',
        falsePositiveNotes: 'Some URLs use username-like routing tokens; treat them as sensitive unless proven otherwise.'
    },
    base_url_query_present: {
        riskReason: 'Query strings may contain routing hints, tenant identifiers, or credentials that are easy to leak.',
        recommendedAction: 'Remove query parameters from base_url and pass configuration through safer documented channels.',
        falsePositiveNotes: 'Some gateways require benign query parameters, but they should still be reviewed before sharing reports.'
    },
    third_party_gateway: {
        riskReason: 'Third-party gateways can log, route, transform, or retain requests outside the original model provider.',
        recommendedAction: 'Review privacy policy, retention, upstream provider routing, and whether prompts are used for training or analytics.',
        falsePositiveNotes: 'This is informational and does not imply suspicious behavior by itself.'
    },
    response_model_missing: {
        riskReason: 'Missing model metadata reduces transparency and makes requested-vs-returned model comparison impossible.',
        recommendedAction: 'Ask the gateway operator whether model metadata is intentionally omitted and compare against provider documentation.',
        falsePositiveNotes: 'Some nonstandard compatible APIs omit this field even when routing honestly.'
    },
    usage_missing: {
        riskReason: 'Missing usage prevents independent review of token accounting and billing-related behavior.',
        recommendedAction: 'Repeat with non-stream mode and request documented usage reporting from the gateway operator.',
        falsePositiveNotes: 'Some providers omit usage for streaming or special endpoints; this finding only scores non-stream responses.'
    },
    usage_token_fields_invalid: {
        riskReason: 'Invalid token fields make accounting unreliable.',
        recommendedAction: 'Capture redacted examples and compare against the provider schema.',
        falsePositiveNotes: 'Schema variants can use different field names, but OpenAI-compatible chat completions should expose these fields when usage is present.'
    },
    usage_total_inconsistent: {
        riskReason: 'Inconsistent totals can indicate accounting bugs or gateway-side transformation.',
        recommendedAction: 'Repeat multiple times and compare with provider dashboard billing if available.',
        falsePositiveNotes: 'Provider-specific hidden reasoning or cached token fields can complicate direct totals; inspect schema details.'
    },
    response_id_missing: {
        riskReason: 'Missing response ids make incident follow-up and provider-side tracing harder.',
        recommendedAction: 'Ask for request/response id support or preserve gateway logs locally with secrets redacted.',
        falsePositiveNotes: 'Some small compatible servers do not implement ids.'
    },
    system_fingerprint_missing: {
        riskReason: 'Missing fingerprints reduce reproducibility and backend transparency.',
        recommendedAction: 'Treat as a transparency gap, not standalone evidence of model substitution.',
        falsePositiveNotes: 'Many providers legitimately omit system_fingerprint.'
    },
    request_id_header_missing: {
        riskReason: 'Missing request id headers reduce traceability across gateway and provider support.',
        recommendedAction: 'Check whether another documented request id header is available and consider adding it to the tool.',
        falsePositiveNotes: 'Some gateways expose ids only in body fields.'
    },
    latency_high: {
        riskReason: 'High latency can indicate routing, queueing, retries, or upstream fallback.',
        recommendedAction: 'Repeat with more samples and compare against direct provider calls from the same network.',
        falsePositiveNotes: 'Network congestion and cold starts can cause benign latency spikes.'
    },
    latency_very_high: {
        riskReason: 'Very high latency can indicate retries, hidden fallback, overloaded gateways, or remote routing issues.',
        recommendedAction: 'Repeat with more samples, inspect gateway status, and compare direct-provider latency.',
        falsePositiveNotes: 'Long prompts, large completions, and temporary provider incidents can be benign causes.'
    },
    stream_malformed_chunks: {
        riskReason: 'Malformed SSE chunks can break client compatibility and may indicate nonstandard stream transformation.',
        recommendedAction: 'Save the redacted audit report and compare stream behavior against OpenAI-compatible SSE format.',
        falsePositiveNotes: 'Some gateways send comments or keepalive lines; those should not be counted as malformed unless JSON data chunks are invalid.'
    },
    stream_no_chunks: {
        riskReason: 'A stream that completes without valid chunks is not useful for compatible streaming clients.',
        recommendedAction: 'Retry and inspect whether the gateway buffers responses or disables streaming.',
        falsePositiveNotes: 'Immediate upstream errors may produce empty streams; compare status code and headers.'
    }
};
export function redactSecret(value) {
    if (!value)
        return null;
    return '[redacted-secret]';
}
export function redactUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        const hadUsername = Boolean(parsed.username);
        const hadPassword = Boolean(parsed.password);
        const hadQuery = Boolean(parsed.search);
        parsed.username = '';
        parsed.password = '';
        parsed.search = '';
        parsed.hash = '';
        return {
            redacted: parsed.toString().replace(/\/$/, ''),
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            hadCredentials: hadUsername || hadPassword,
            hadQuery
        };
    }
    catch {
        return {
            redacted: '[invalid-url]',
            protocol: null,
            hostname: null,
            hadCredentials: false,
            hadQuery: false
        };
    }
}
export function classifyBaseUrlRisk(rawUrl) {
    const redacted = redactUrl(rawUrl);
    const findings = [];
    if (redacted.redacted === '[invalid-url]') {
        findings.push(finding('base_url_invalid', 'high', 30, 'base_url is not a valid URL.'));
        return { redacted, findings };
    }
    if (redacted.protocol !== 'https:' && redacted.hostname !== 'localhost' && redacted.hostname !== '127.0.0.1') {
        findings.push(finding('base_url_not_https', 'high', 20, 'Remote base_url does not use HTTPS.'));
    }
    if (redacted.hadCredentials) {
        findings.push(finding('base_url_embedded_credentials', 'high', 30, 'base_url contained embedded credentials; reports redact them.'));
    }
    if (redacted.hadQuery) {
        findings.push(finding('base_url_query_present', 'medium', 10, 'base_url contained query parameters; check for leaked routing or credentials.'));
    }
    if (redacted.hostname && !['api.openai.com', 'localhost', '127.0.0.1'].includes(redacted.hostname)) {
        findings.push(finding('third_party_gateway', 'info', 0, 'Third-party gateway: review privacy policy, logging, retention, and provider routing.'));
    }
    return { redacted, findings };
}
export function finding(code, severity, score, message, evidence = {}) {
    const rubric = SCORING_RUBRIC.find((item) => item.code === code);
    const guidance = FINDING_GUIDANCE[code] ?? {
        riskReason: 'This signal may reduce gateway transparency.',
        recommendedAction: 'Review the redacted evidence and repeat the audit if the result matters.',
        falsePositiveNotes: 'Provider-specific behavior may explain this finding.'
    };
    return {
        schemaVersion: 'finding.v1',
        code,
        category: rubric?.category ?? 'unknown',
        severity,
        score,
        message,
        evidence,
        docsSlug: code.replaceAll('_', '-'),
        ...guidance
    };
}
export function scoreFindings(findings) {
    const score = Math.min(100, findings.reduce((sum, item) => sum + item.score, 0));
    let level = 'low';
    if (score >= 70)
        level = 'critical';
    else if (score >= 40)
        level = 'high';
    else if (score >= 20)
        level = 'medium';
    return { score, level };
}
export function analyzeCompletion({ requestedModel, response, latencyMs, headers, stream }) {
    const findings = [];
    const responseModel = response?.model ?? stream?.observedModel ?? null;
    if (responseModel && requestedModel && responseModel !== requestedModel) {
        findings.push(finding('model_mismatch', 'high', 30, 'Response model differs from requested model.', {
            requestedModel,
            responseModel
        }));
    }
    if (!responseModel) {
        findings.push(finding('response_model_missing', 'medium', 15, 'Response did not include a model field.'));
    }
    const usage = response?.usage ?? null;
    if (!stream && !usage) {
        findings.push(finding('usage_missing', 'medium', 20, 'Non-stream response did not include usage.'));
    }
    if (usage) {
        const tokenFields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
        const invalid = tokenFields.filter((key) => !Number.isInteger(usage[key]) || usage[key] < 0);
        if (invalid.length > 0) {
            findings.push(finding('usage_token_fields_invalid', 'medium', 15, 'Usage token fields are missing, negative, or non-integer.', { invalid }));
        }
        else if (usage.prompt_tokens + usage.completion_tokens !== usage.total_tokens) {
            findings.push(finding('usage_total_inconsistent', 'medium', 15, 'prompt_tokens + completion_tokens does not equal total_tokens.', {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens
            }));
        }
    }
    if (!response?.id && !stream?.observedId) {
        findings.push(finding('response_id_missing', 'medium', 10, 'Response id is missing.'));
    }
    if (!response?.system_fingerprint && !stream?.observedSystemFingerprint) {
        findings.push(finding('system_fingerprint_missing', 'info', 5, 'system_fingerprint is missing; some providers omit it, but it reduces transparency.'));
    }
    if (!headers.requestId) {
        findings.push(finding('request_id_header_missing', 'info', 5, 'No recognizable request id header was returned.'));
    }
    if (latencyMs > 30000) {
        findings.push(finding('latency_very_high', 'medium', 15, 'Request latency exceeded 30 seconds.', { latencyMs }));
    }
    else if (latencyMs > 10000) {
        findings.push(finding('latency_high', 'low', 5, 'Request latency exceeded 10 seconds.', { latencyMs }));
    }
    if (stream?.malformedChunks > 0) {
        findings.push(finding('stream_malformed_chunks', 'high', 25, 'Stream contained malformed SSE JSON chunks.', {
            malformedChunks: stream.malformedChunks
        }));
    }
    if (stream && stream.chunkCount === 0) {
        findings.push(finding('stream_no_chunks', 'high', 25, 'Stream completed without valid chunks.'));
    }
    return findings;
}
export function extractHeaders(headers) {
    const selected = {};
    for (const [key, value] of headers.entries()) {
        const lower = key.toLowerCase();
        if (REQUEST_ID_HEADERS.includes(lower) || lower.startsWith('openai-') || lower === 'content-type') {
            selected[lower] = value;
        }
    }
    const requestIdKey = REQUEST_ID_HEADERS.find((key) => selected[key]);
    return {
        selected,
        requestId: requestIdKey ? selected[requestIdKey] : null
    };
}
export async function callChatCompletion(options) {
    const endpoint = resolveChatCompletionsEndpoint(options.baseUrl);
    const body = {
        model: options.model,
        messages: [{ role: 'user', content: options.prompt }],
        stream: options.stream
    };
    const started = performance.now();
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'authorization': `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
            'user-agent': 'llm-gateway-audit/0.2.5'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeoutMs)
    });
    const latencyMs = Math.round(performance.now() - started);
    const headers = extractHeaders(response.headers);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Gateway returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    if (options.stream) {
        const stream = await parseSseStream(response);
        return { latencyMs, headers, response: null, stream };
    }
    const json = await response.json();
    return { latencyMs, headers, response: json, stream: null };
}
export async function parseSseStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
        return { chunkCount: 0, malformedChunks: 1, doneSeen: false };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let malformedChunks = 0;
    let doneSeen = false;
    let observedModel = null;
    let observedId = null;
    let observedSystemFingerprint = null;
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
            for (const line of part.split(/\r?\n/)) {
                if (!line.startsWith('data:'))
                    continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') {
                    doneSeen = true;
                    continue;
                }
                try {
                    const json = JSON.parse(data);
                    chunkCount += 1;
                    observedModel ??= json.model ?? null;
                    observedId ??= json.id ?? null;
                    observedSystemFingerprint ??= json.system_fingerprint ?? null;
                    if (!Array.isArray(json.choices))
                        malformedChunks += 1;
                }
                catch {
                    malformedChunks += 1;
                }
            }
        }
    }
    if (buffer.trim())
        malformedChunks += 1;
    return { chunkCount, malformedChunks, doneSeen, observedModel, observedId, observedSystemFingerprint };
}
export async function runAudit(options) {
    const baseUrlRisk = classifyBaseUrlRisk(options.baseUrl);
    const runs = [];
    for (let i = 0; i < options.repeat; i += 1) {
        const result = await callChatCompletion(options);
        const findings = [
            ...baseUrlRisk.findings,
            ...analyzeCompletion({
                requestedModel: options.model,
                response: result.response,
                latencyMs: result.latencyMs,
                headers: result.headers,
                stream: result.stream
            })
        ];
        const risk = scoreFindings(findings);
        runs.push({
            index: i + 1,
            mode: options.stream ? 'stream' : 'non-stream',
            requestedModel: options.model,
            responseModel: result.response?.model ?? result.stream?.observedModel ?? null,
            latencyMs: result.latencyMs,
            responseIdPresent: Boolean(result.response?.id ?? result.stream?.observedId),
            systemFingerprintPresent: Boolean(result.response?.system_fingerprint ?? result.stream?.observedSystemFingerprint),
            usage: result.response?.usage ?? null,
            stream: result.stream,
            headers: result.headers,
            findings,
            risk
        });
    }
    const aggregateScore = Math.max(...runs.map((run) => run.risk.score), 0);
    return {
        tool: 'llm-gateway-audit',
        version: '0.2.5',
        schemaVersion: 'audit-report.v1',
        generatedAt: new Date().toISOString(),
        privacy: {
            promptStored: false,
            apiKeyStored: false,
            rawResponseBodyStored: false,
            promptLength: options.prompt.length
        },
        target: {
            baseUrl: baseUrlRisk.redacted.redacted,
            baseUrlHost: baseUrlRisk.redacted.hostname,
            apiKeyEnv: options.apiKeyEnv,
            apiKey: redactSecret(options.apiKey),
            model: options.model
        },
        summary: {
            repeat: options.repeat,
            stream: options.stream,
            suspiciousScore: aggregateScore,
            riskLevel: scoreFindings([{ score: aggregateScore }]).level,
            caveat: 'This audit reports suspicious evidence and transparency gaps. It cannot definitively prove the real model identity.',
            scoring: {
                method: 'Add finding scores per run, cap each run at 100, and use the maximum run score as the summary score.',
                rubric: SCORING_RUBRIC
            }
        },
        runs
    };
}
export async function writeReports(report, outputBase) {
    const jsonPath = resolve(`${outputBase}.json`);
    const markdownPath = resolve(`${outputBase}.md`);
    await mkdir(dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(markdownPath, renderMarkdown(report), 'utf8');
    return { jsonPath, markdownPath };
}
export function renderMarkdown(report) {
    const lines = [];
    lines.push('# LLM Gateway Audit Report');
    lines.push('');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push(`Target: \`${report.target.baseUrl}\``);
    lines.push(`Requested model: \`${report.target.model}\``);
    lines.push(`Mode: ${report.summary.stream ? 'stream' : 'non-stream'}`);
    lines.push(`Suspicious score: **${report.summary.suspiciousScore}/100** (${report.summary.riskLevel})`);
    lines.push('');
    lines.push('> This audit reports suspicious evidence and transparency gaps. It cannot definitively prove the real model identity.');
    lines.push('');
    lines.push('## Privacy');
    lines.push('');
    lines.push('- Prompt stored: no');
    lines.push('- API key stored: no');
    lines.push(`- Prompt length: ${report.privacy.promptLength}`);
    lines.push('');
    lines.push('## Findings');
    for (const run of report.runs) {
        lines.push('');
        lines.push(`### Run ${run.index}`);
        lines.push('');
        lines.push(`- Response model: ${run.responseModel ? `\`${run.responseModel}\`` : 'missing'}`);
        lines.push(`- Latency: ${run.latencyMs} ms`);
        lines.push(`- Response id present: ${run.responseIdPresent ? 'yes' : 'no'}`);
        lines.push(`- system_fingerprint present: ${run.systemFingerprintPresent ? 'yes' : 'no'}`);
        lines.push(`- Risk: ${run.risk.score}/100 (${run.risk.level})`);
        if (run.findings.length === 0) {
            lines.push('- No suspicious findings in this run.');
        }
        else {
            for (const item of run.findings) {
                lines.push(`- [${item.severity}] ${item.code}: ${item.message}`);
                lines.push(`  - Risk reason: ${item.riskReason}`);
                lines.push(`  - Recommended action: ${item.recommendedAction}`);
                lines.push(`  - False positive notes: ${item.falsePositiveNotes}`);
            }
        }
    }
    lines.push('');
    lines.push('## Scoring Rubric');
    lines.push('');
    lines.push('| Code | Severity | Score | Description |');
    lines.push('| --- | --- | ---: | --- |');
    for (const item of report.summary.scoring.rubric) {
        lines.push(`| ${item.code} | ${item.severity} | ${item.score} | ${item.description} |`);
    }
    lines.push('');
    return `${lines.join('\n')}\n`;
}
export function resolveChatCompletionsEndpoint(baseUrl) {
    const parsed = new URL(baseUrl);
    parsed.search = '';
    parsed.hash = '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const lastTwo = parts.slice(-2).join('/');
    if (lastTwo !== 'chat/completions') {
        if (parts.at(-1) === 'v1') {
            parts.push('chat', 'completions');
        }
        else {
            parts.push('v1', 'chat', 'completions');
        }
    }
    parsed.pathname = `/${parts.join('/')}`;
    return parsed.toString();
}
export function compareAuditReports(baseline, candidate) {
    const baselineCodes = collectFindingCodes(baseline);
    const candidateCodes = collectFindingCodes(candidate);
    const baselineSet = new Set(baselineCodes);
    const candidateSet = new Set(candidateCodes);
    const addedFindings = [...candidateSet].filter((code) => !baselineSet.has(code)).sort();
    const resolvedFindings = [...baselineSet].filter((code) => !candidateSet.has(code)).sort();
    const commonFindings = [...candidateSet].filter((code) => baselineSet.has(code)).sort();
    const baselineModels = collectResponseModels(baseline);
    const candidateModels = collectResponseModels(candidate);
    const baselineScore = baseline?.summary?.suspiciousScore ?? null;
    const candidateScore = candidate?.summary?.suspiciousScore ?? null;
    return {
        schemaVersion: 'report-comparison.v1',
        generatedAt: new Date().toISOString(),
        privacy: {
            promptStored: false,
            apiKeyStored: false,
            rawResponseBodyStored: false
        },
        baseline: summarizeReportForComparison(baseline),
        candidate: summarizeReportForComparison(candidate),
        delta: {
            suspiciousScore: baselineScore === null || candidateScore === null ? null : candidateScore - baselineScore,
            addedFindings,
            resolvedFindings,
            commonFindings,
            responseModelsChanged: JSON.stringify(baselineModels) !== JSON.stringify(candidateModels),
            usagePresenceChanged: collectUsagePresence(baseline).join(',') !== collectUsagePresence(candidate).join(',')
        },
        caveat: 'This comparison uses redacted audit reports. It highlights metadata and transparency differences, not proof of real model identity.'
    };
}
export function validateAuditReport(report) {
    const issues = [];
    if (report?.schemaVersion !== 'audit-report.v1') {
        issues.push(validationIssue('schema_version_invalid', 'high', 'Report schemaVersion must be audit-report.v1.'));
    }
    if (report?.tool !== 'llm-gateway-audit') {
        issues.push(validationIssue('tool_invalid', 'medium', 'Report tool must be llm-gateway-audit.'));
    }
    if (report?.privacy?.promptStored !== false) {
        issues.push(validationIssue('prompt_stored_flag_invalid', 'high', 'Report privacy.promptStored must be false.'));
    }
    if (report?.privacy?.apiKeyStored !== false) {
        issues.push(validationIssue('api_key_stored_flag_invalid', 'high', 'Report privacy.apiKeyStored must be false.'));
    }
    if (report?.privacy?.rawResponseBodyStored !== false) {
        issues.push(validationIssue('raw_response_body_flag_invalid', 'high', 'Report privacy.rawResponseBodyStored must be false.'));
    }
    if (typeof report?.privacy?.promptLength !== 'number' || report.privacy.promptLength < 0) {
        issues.push(validationIssue('prompt_length_invalid', 'medium', 'Report privacy.promptLength must be a non-negative number.'));
    }
    if (typeof report?.target?.apiKey === 'string' && /^(sk-|sess-|ghp_|github_pat_)/i.test(report.target.apiKey)) {
        issues.push(validationIssue('api_key_looks_unredacted', 'critical', 'Report target.apiKey looks like an unredacted secret.'));
    }
    if (typeof report?.target?.baseUrl === 'string' && /[?&](api[_-]?key|token|key|secret)=/i.test(report.target.baseUrl)) {
        issues.push(validationIssue('base_url_query_secret_like', 'high', 'Report target.baseUrl contains secret-like query parameters.'));
    }
    for (const [runIndex, run] of (report?.runs ?? []).entries()) {
        for (const [findingIndex, item] of (run.findings ?? []).entries()) {
            if (item.schemaVersion !== 'finding.v1') {
                issues.push(validationIssue('finding_schema_version_invalid', 'medium', `Finding at run ${runIndex + 1}, index ${findingIndex + 1} must use finding.v1.`));
            }
            for (const field of ['code', 'category', 'severity', 'message', 'riskReason', 'recommendedAction', 'falsePositiveNotes']) {
                if (!item[field]) {
                    issues.push(validationIssue('finding_required_field_missing', 'medium', `Finding at run ${runIndex + 1}, index ${findingIndex + 1} is missing ${field}.`));
                }
            }
        }
    }
    const serialized = JSON.stringify(report);
    const suspiciousPatterns = [
        { code: 'secret_like_openai_key', pattern: /sk-[A-Za-z0-9_-]{12,}/ },
        { code: 'secret_like_github_token', pattern: /(ghp_|github_pat_)[A-Za-z0-9_]+/ },
        { code: 'authorization_header_present', pattern: /authorization["'\s:]+bearer/i }
    ];
    for (const item of suspiciousPatterns) {
        if (item.pattern.test(serialized)) {
            issues.push(validationIssue(item.code, 'critical', `Report contains ${item.code}.`));
        }
    }
    return {
        schemaVersion: 'report-validation.v1',
        valid: issues.length === 0,
        issueCount: issues.length,
        issues,
        privacy: {
            promptStored: false,
            apiKeyStored: false,
            rawResponseBodyStored: false
        },
        caveat: 'Validation checks report shape and common redaction risks. It cannot prove that all sensitive data has been removed.'
    };
}
function validationIssue(code, severity, message) {
    return { code, severity, message };
}
function collectFindingCodes(report) {
    return (report?.runs ?? []).flatMap((run) => (run.findings ?? []).map((item) => item.code)).filter(Boolean);
}
function collectResponseModels(report) {
    return [...new Set((report?.runs ?? []).map((run) => run.responseModel ?? null))];
}
function collectUsagePresence(report) {
    return (report?.runs ?? []).map((run) => Boolean(run.usage));
}
function summarizeReportForComparison(report) {
    return {
        schemaVersion: report?.schemaVersion ?? null,
        toolVersion: report?.version ?? null,
        targetHost: report?.target?.baseUrlHost ?? null,
        targetBaseUrl: report?.target?.baseUrl ?? null,
        requestedModel: report?.target?.model ?? null,
        suspiciousScore: report?.summary?.suspiciousScore ?? null,
        riskLevel: report?.summary?.riskLevel ?? null,
        runCount: report?.runs?.length ?? 0,
        responseModels: collectResponseModels(report),
        usagePresentByRun: collectUsagePresence(report),
        findingCodes: [...new Set(collectFindingCodes(report))].sort()
    };
}
