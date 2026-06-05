# Field Validation Log Template

Use this template when testing real gateways with harmless prompts.

## Test Metadata

- Date:
- Tester:
- Network region:
- Tool version:
- Command mode: non-stream / stream / both
- Prompt source: inline harmless prompt / prompt file

## Gateway

- Gateway name:
- Redacted base_url:
- Requested model:
- API key type: temporary / low-privilege / other
- Provider documentation link:

## Commands

Dry run:

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --dry-run
```

Audit:

```bash
node ./dist/cli.js --base-url "https://gateway.example.com" --model "gpt-4.1-mini" --prompt "Say hello in one short sentence." --repeat 3 --out reports/gateway
```

Validate:

```bash
node ./dist/cli.js --validate-report reports/gateway.json
```

## Results

- Suspicious score:
- Risk level:
- Response model(s):
- Usage present:
- Response id present:
- Request id header present:
- system_fingerprint present:
- Stream chunk status:

## Findings

| Code | Severity | Notes |
| --- | --- | --- |
| | | |

## Interpretation

- What evidence is confirmed by the report?
- What remains only a suspicion?
- Which findings may be provider-specific false positives?
- What follow-up is needed?

## Sharing Check

- [ ] No real prompt is present.
- [ ] No API key is present.
- [ ] No raw response body is present.
- [ ] No base_url query secret or embedded credential is present.
- [ ] `--validate-report` passed or issues are documented.
- [ ] Screenshots do not expose private identity or account data.
