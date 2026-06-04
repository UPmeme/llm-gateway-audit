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

## Build

```bash
npm install
npm run build
```

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

Prompt from a local file:

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt-file ./prompt.txt
```

The prompt file path and raw prompt content are not stored in reports.

Stream mode:

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --stream
```

Dry run without sending a request:

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --dry-run
```

## Config File

You can use a safe JSON config file for non-secret options:

```bash
cp llm-gateway-audit.config.example.json llm-gateway-audit.config.json
node ./dist/cli.js --config llm-gateway-audit.config.json --prompt "Say hello."
```

Config files may contain `base_url`, `api_key_env`, `model`, `repeat`, `stream`, `timeout_ms`, and `out`.

Config files must not contain real API keys, prompts, tokens, messages, or authorization headers. The CLI rejects sensitive config fields such as `api_key`, `prompt`, `token`, and `messages`.

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

## Scoring

The suspicious score is evidence-oriented and intentionally conservative. Each run adds finding scores, caps the run at 100, and the report summary uses the highest run score.

| Signal | Score |
| --- | ---: |
| Response model differs from requested model | 30 |
| Invalid `base_url` or embedded credentials | 30 |
| Malformed or empty stream chunks | 25 |
| Missing non-stream `usage` | 20 |
| Remote `base_url` without HTTPS | 20 |
| Missing response `model` or invalid token accounting | 15 |
| Missing response id or risky URL query parameters | 10 |
| Missing transparency metadata such as request id header or `system_fingerprint` | 5 |

Reports include risk reason, recommended action, and false-positive notes for each finding.

## Sample Reports

Redacted examples are available in [`examples/reports`](examples/reports):

- Honest gateway
- Model mismatch
- Missing usage
- Fake stream

## Finding Schema

Finding JSON uses a stable `finding.v1` shape with `code`, `category`, `severity`, `score`, redacted `evidence`, `riskReason`, `recommendedAction`, and `falsePositiveNotes`.

See [`docs/finding-schema.md`](docs/finding-schema.md).

Machine-readable JSON schemas are available in [`schemas`](schemas).

## Field Testing

Use [`docs/field-test-playbook.md`](docs/field-test-playbook.md) before testing real gateways. It covers temporary keys, harmless prompts, dry-run, stream/non-stream audits, and redacted report comparison.

Compare two redacted JSON reports without sending new requests:

```bash
node ./dist/cli.js --compare-report reports/baseline.json reports/gateway.json
```

Validate a redacted JSON report before sharing it:

```bash
node ./dist/cli.js --validate-report reports/gateway.json
```

Before npm publishing, use [`docs/npm-publish-checklist.md`](docs/npm-publish-checklist.md).

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
npm run verify
```

The test suite uses local mock gateways only.
