import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeCompletion, compareAuditReports, redactUrl, SCORING_RUBRIC } from '../dist/audit.js';
import { providerFixtures } from './provider-fixtures.js';

describe('audit rules and fixtures', () => {
  it('documents every scoring code only once', () => {
    const codes = SCORING_RUBRIC.map((item) => item.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(codes.includes('model_mismatch'));
    assert.ok(codes.includes('usage_missing'));
    assert.ok(codes.includes('stream_malformed_chunks'));
    assert.ok(SCORING_RUBRIC.every((item) => item.category));
  });

  it('emits stable finding schema fields', () => {
    const findings = analyzeCompletion({
      requestedModel: 'requested-model',
      response: {
        id: 'chatcmpl_fixture',
        model: 'different-model',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      },
      latencyMs: 100,
      headers: { requestId: null },
      stream: null
    });
    const finding = findings.find((item) => item.code === 'model_mismatch');
    assert.equal(finding.schemaVersion, 'finding.v1');
    assert.equal(finding.category, 'model');
    assert.equal(finding.docsSlug, 'model-mismatch');
    assert.ok(finding.riskReason);
    assert.ok(finding.recommendedAction);
    assert.ok(finding.falsePositiveNotes);
  });

  it('flags inconsistent usage totals', () => {
    const findings = analyzeCompletion({
      requestedModel: 'requested-model',
      response: {
        id: 'chatcmpl_fixture',
        model: 'requested-model',
        system_fingerprint: 'fp_fixture',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 99 }
      },
      latencyMs: 100,
      headers: { requestId: 'req_fixture' },
      stream: null
    });
    assert.ok(findings.some((item) => item.code === 'usage_total_inconsistent'));
  });

  it('flags missing model metadata', () => {
    const findings = analyzeCompletion({
      requestedModel: 'requested-model',
      response: {
        id: 'chatcmpl_fixture',
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      },
      latencyMs: 100,
      headers: { requestId: 'req_fixture' },
      stream: null
    });
    assert.ok(findings.some((item) => item.code === 'response_model_missing'));
  });

  it('flags empty streams', () => {
    const findings = analyzeCompletion({
      requestedModel: 'requested-model',
      response: null,
      latencyMs: 100,
      headers: { requestId: 'req_fixture' },
      stream: { chunkCount: 0, malformedChunks: 0, doneSeen: true }
    });
    assert.ok(findings.some((item) => item.code === 'stream_no_chunks'));
  });

  it('redacts URL credentials, query strings, and fragments', () => {
    const result = redactUrl('https://user:pass@gateway.example.test/v1?token=secret#fragment');
    assert.equal(result.redacted, 'https://gateway.example.test/v1');
    assert.equal(result.hadCredentials, true);
    assert.equal(result.hadQuery, true);
  });

  it('compares redacted audit reports', () => {
    const baseline = {
      schemaVersion: 'audit-report.v1',
      version: '0.2.1',
      target: { baseUrlHost: 'api.openai.com', baseUrl: 'https://api.openai.com', model: 'gpt-4.1-mini' },
      summary: { suspiciousScore: 0, riskLevel: 'low' },
      runs: [{ responseModel: 'gpt-4.1-mini', usage: { total_tokens: 10 }, findings: [] }]
    };
    const candidate = {
      schemaVersion: 'audit-report.v1',
      version: '0.2.1',
      target: { baseUrlHost: 'gateway.example.com', baseUrl: 'https://gateway.example.com', model: 'gpt-4.1-mini' },
      summary: { suspiciousScore: 30, riskLevel: 'medium' },
      runs: [{
        responseModel: 'different-model',
        usage: { total_tokens: 10 },
        findings: [{ code: 'model_mismatch' }]
      }]
    };
    const comparison = compareAuditReports(baseline, candidate);
    assert.equal(comparison.schemaVersion, 'report-comparison.v1');
    assert.equal(comparison.delta.suspiciousScore, 30);
    assert.deepEqual(comparison.delta.addedFindings, ['model_mismatch']);
    assert.equal(comparison.delta.responseModelsChanged, true);
    assert.equal(comparison.privacy.promptStored, false);
  });

  for (const fixture of providerFixtures) {
    it(`handles provider fixture: ${fixture.name}`, () => {
      const findings = analyzeCompletion({
        requestedModel: fixture.requestedModel,
        response: fixture.response,
        latencyMs: 100,
        headers: fixture.headers,
        stream: fixture.stream
      });
      const codes = findings.map((item) => item.code);
      for (const code of fixture.expected ?? []) {
        assert.ok(codes.includes(code), `${fixture.name} should include ${code}`);
      }
      for (const code of fixture.expectedAbsent ?? []) {
        assert.equal(codes.includes(code), false, `${fixture.name} should not include ${code}`);
      }
    });
  }
});
