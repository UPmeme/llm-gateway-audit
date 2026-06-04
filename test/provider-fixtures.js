export const providerFixtures = [
  {
    name: 'openai-standard-non-stream',
    requestedModel: 'gpt-4.1-mini',
    response: {
      id: 'chatcmpl_openai_fixture',
      object: 'chat.completion',
      model: 'gpt-4.1-mini',
      system_fingerprint: 'fp_fixture',
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 }
    },
    headers: { requestId: 'req_openai_fixture' },
    stream: null,
    expectedAbsent: ['model_mismatch', 'usage_missing']
  },
  {
    name: 'litellm-alias-canonical-model',
    requestedModel: 'gpt-4.1-mini',
    response: {
      id: 'chatcmpl_litellm_fixture',
      object: 'chat.completion',
      model: 'openai/gpt-4.1-mini',
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 }
    },
    headers: { requestId: 'req_litellm_fixture' },
    stream: null,
    expected: ['model_mismatch', 'system_fingerprint_missing']
  },
  {
    name: 'one-api-missing-fingerprint',
    requestedModel: 'gpt-4.1-mini',
    response: {
      id: 'chatcmpl_one_api_fixture',
      object: 'chat.completion',
      model: 'gpt-4.1-mini',
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
    },
    headers: { requestId: 'req_one_api_fixture' },
    stream: null,
    expected: ['system_fingerprint_missing']
  },
  {
    name: 'openrouter-style-request-id-header-only',
    requestedModel: 'openai/gpt-4.1-mini',
    response: {
      id: 'gen_openrouter_fixture',
      object: 'chat.completion',
      model: 'openai/gpt-4.1-mini',
      usage: { prompt_tokens: 6, completion_tokens: 6, total_tokens: 12 }
    },
    headers: { requestId: 'req_openrouter_fixture' },
    stream: null,
    expected: ['system_fingerprint_missing']
  },
  {
    name: 'azure-like-model-omitted',
    requestedModel: 'deployment-name',
    response: {
      id: 'chatcmpl_azure_fixture',
      object: 'chat.completion',
      usage: { prompt_tokens: 4, completion_tokens: 4, total_tokens: 8 }
    },
    headers: { requestId: 'req_azure_fixture' },
    stream: null,
    expected: ['response_model_missing']
  },
  {
    name: 'stream-final-usage-compatible',
    requestedModel: 'gpt-4.1-mini',
    response: null,
    headers: { requestId: 'req_stream_fixture' },
    stream: {
      chunkCount: 2,
      malformedChunks: 0,
      doneSeen: true,
      observedModel: 'gpt-4.1-mini',
      observedId: 'chatcmpl_stream_fixture',
      observedSystemFingerprint: 'fp_stream_fixture'
    },
    expectedAbsent: ['stream_malformed_chunks', 'stream_no_chunks', 'model_mismatch']
  }
];
