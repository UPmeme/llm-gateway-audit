# Field Test Playbook

Use this playbook to test a real OpenAI-compatible gateway without exposing private data.

## Goal

Collect redacted transparency evidence:

- requested model vs response `model`
- `usage` presence and token accounting shape
- latency
- response id and request id headers
- `system_fingerprint`
- stream chunk structure
- suspicious score and findings

This playbook does not prove the true upstream model identity.

## Safety Rules

- Use a temporary or low-privilege API key when possible.
- Use a harmless prompt such as `Say hello in one short sentence.`
- Do not use private prompts, customer data, code secrets, account identifiers, or production logs.
- Prefer `--prompt-file` over `--prompt` if you do not want the prompt in shell history.
- Review generated reports before sharing them.
- Do not publish raw gateway logs.

## Baseline Flow

Run a dry run first:

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt "Say hello in one short sentence." \
  --dry-run
```

Run a non-stream audit:

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt "Say hello in one short sentence." \
  --repeat 3 \
  --non-stream \
  --out reports/gateway-non-stream
```

Run a stream audit:

```bash
node ./dist/cli.js \
  --base-url "https://gateway.example.com" \
  --model "gpt-4.1-mini" \
  --prompt "Say hello in one short sentence." \
  --repeat 3 \
  --stream \
  --out reports/gateway-stream
```

## Compare Reports

If you have two redacted JSON reports, compare them without sending new requests:

```bash
node ./dist/cli.js \
  --compare-report reports/baseline.json reports/gateway.json
```

The comparison highlights score deltas, added/resolved finding codes, response model changes, and usage-presence changes.

## Validate Before Sharing

Before sharing a JSON report, run:

```bash
node ./dist/cli.js --validate-report reports/gateway.json
```

This checks report shape and common redaction risks. It does not prove that every possible sensitive value has been removed, so still review manually.

## Interpreting Results

- `model_mismatch` is strong transparency evidence, but still check whether the gateway documents aliases.
- `usage_missing` affects accounting review, especially for non-stream responses.
- `request_id_header_missing` and `response_id_missing` reduce traceability.
- `system_fingerprint_missing` is common and should not be treated as standalone evidence.
- Latency findings need repeated samples and comparison from the same network.

## Public Sharing Checklist

Before posting a report:

- Confirm no real prompt is present.
- Confirm no API key is present.
- Confirm `base_url` query strings and credentials are redacted.
- Run `--validate-report` and review any issues.
- Confirm screenshots do not show browser accounts, local paths, tokens, or private environment details.
- Include the caveat that the report shows suspicious evidence and transparency gaps, not proof of true model identity.
