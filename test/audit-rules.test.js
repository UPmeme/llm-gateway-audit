import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeCompletion, redactUrl, SCORING_RUBRIC } from '../dist/audit.js';

describe('audit rules and fixtures', () => {
  it('documents every scoring code only once', () => {
    const codes = SCORING_RUBRIC.map((item) => item.code);
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(codes.includes('model_mismatch'));
    assert.ok(codes.includes('usage_missing'));
    assert.ok(codes.includes('stream_malformed_chunks'));
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
});
