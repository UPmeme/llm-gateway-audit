import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { redactUrl, renderMarkdown, runAudit } from '../dist/audit.js';

let server;
let baseUrl;
let mode;

beforeEach(async () => {
  server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    await new Promise((resolve) => req.on('end', resolve));
    const payload = JSON.parse(body);
    res.setHeader('content-type', payload.stream ? 'text/event-stream' : 'application/json');
    res.setHeader('x-request-id', 'req_mock_123');

    if (mode === 'fake-stream') {
      res.writeHead(200);
      res.write('data: not-json\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const responseModel = mode === 'model-mismatch' ? 'different-model' : payload.model;
    const response = {
      id: 'chatcmpl_mock',
      object: 'chat.completion',
      created: 1,
      model: responseModel,
      system_fingerprint: 'fp_mock',
      choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }]
    };
    if (mode !== 'missing-usage') {
      response.usage = { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 };
    }
    if (payload.stream) {
      res.writeHead(200);
      res.write(`data: ${JSON.stringify({ ...response, object: 'chat.completion.chunk', choices: [{ delta: { content: 'hello' }, index: 0 }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(response));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function options(extra = {}) {
  return {
    baseUrl,
    apiKey: `sk-${'test-redacted'}`,
    apiKeyEnv: 'OPENAI_API_KEY',
    model: 'test-model',
    prompt: 'Do not store this prompt in reports.',
    repeat: 1,
    stream: false,
    timeoutMs: 5000,
    ...extra
  };
}

describe('mock gateway audit', () => {
  it('accepts an honest gateway with low risk', async () => {
    mode = 'honest';
    const report = await runAudit(options());
    assert.equal(report.runs[0].responseModel, 'test-model');
    assert.equal(report.runs[0].usage.total_tokens, 5);
    assert.equal(report.summary.suspiciousScore, 0);
  });

  it('flags a model mismatch gateway', async () => {
    mode = 'model-mismatch';
    const report = await runAudit(options());
    assert.equal(report.runs[0].responseModel, 'different-model');
    assert.ok(report.runs[0].findings.some((item) => item.code === 'model_mismatch'));
    assert.ok(report.summary.suspiciousScore >= 30);
  });

  it('flags a missing usage gateway', async () => {
    mode = 'missing-usage';
    const report = await runAudit(options());
    assert.equal(report.runs[0].usage, null);
    assert.ok(report.runs[0].findings.some((item) => item.code === 'usage_missing'));
  });

  it('flags a fake stream gateway', async () => {
    mode = 'fake-stream';
    const report = await runAudit(options({ stream: true }));
    assert.equal(report.runs[0].stream.malformedChunks, 1);
    assert.ok(report.runs[0].findings.some((item) => item.code === 'stream_malformed_chunks'));
  });

  it('redacts prompts, API keys, and sensitive base_url parts from reports', async () => {
    mode = 'honest';
    const secretPrompt = 'private prompt should never appear in reports';
    const secretKey = 'test-key-super-secret-value';
    const report = await runAudit(options({
      baseUrl: `${baseUrl}?token=secret#fragment`,
      apiKey: secretKey,
      prompt: secretPrompt
    }));
    const json = JSON.stringify(report);
    const markdown = renderMarkdown(report);
    const redactedUrl = redactUrl('https://user:pass@gateway.example.test/v1?token=secret#fragment');

    assert.equal(report.privacy.promptStored, false);
    assert.equal(report.privacy.apiKeyStored, false);
    assert.equal(report.privacy.rawResponseBodyStored, false);
    assert.equal(report.privacy.promptLength, secretPrompt.length);
    assert.equal(report.target.baseUrl.includes('user:pass'), false);
    assert.equal(report.target.baseUrl.includes('token=secret'), false);
    assert.equal(redactedUrl.redacted.includes('user:pass'), false);
    assert.equal(redactedUrl.redacted.includes('token=secret'), false);
    assert.equal(redactedUrl.hadCredentials, true);
    assert.equal(redactedUrl.hadQuery, true);
    assert.equal(json.includes(secretPrompt), false);
    assert.equal(json.includes(secretKey), false);
    assert.equal(markdown.includes(secretPrompt), false);
    assert.equal(markdown.includes(secretKey), false);
  });
});
