# llm-gateway-audit

`llm-gateway-audit` is an open source CLI for auditing OpenAI-compatible LLM gateways and token relay services for suspicious transparency gaps.

It collects redacted evidence about model metadata, usage accounting, latency, stream structure, request IDs, `system_fingerprint`, and `base_url` risk. It does **not** guarantee proof of the real model identity.

## Install

```bash
git clone https://github.com/UPmeme/llm-gateway-audit.git
cd llm-gateway-audit
node ./dist/cli.js --help
```

Node.js 20 or newer is required.

## Usage

```bash
export OPENAI_API_KEY="sk-..."
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt "Say hello in one short sentence." \
  --repeat 3 \
  --non-stream \
  --out reports/example
```

Stream mode:

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --stream
```

## What It Checks

- Requested model vs response `model`
- `usage` presence and token count consistency
- Latency
- Response `id`
- `system_fingerprint`
- Stream chunk shape and malformed SSE chunks
- Request ID and transparency headers
- `base_url` privacy and security risk signals
- Suspicious score based on collected evidence

## Privacy Boundary

Reports are redacted by default:

- API keys are not stored.
- Raw prompts are not stored.
- Raw response bodies are not stored.
- `base_url` credentials, query strings, and fragments are removed.

Do not publish reports without reviewing them for environment-specific metadata.

## Limitations

This tool reports audit evidence, suspicious behavior, transparency gaps, and risk score. It cannot definitively prove model substitution or the true upstream model.

## Test

```bash
npm test
```

The test suite uses local mock gateways only.
