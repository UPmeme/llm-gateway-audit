# Contributing

Thanks for helping improve `llm-gateway-audit`.

## Development

```bash
npm test
```

The v0.1.0 runtime has no third-party dependencies. Keep tests local and deterministic.

## Contribution Rules

- Do not commit API keys, private prompts, private logs, or real gateway reports.
- Use redacted fixtures and local mock gateways.
- Prefer small, focused changes.
- Use audit-oriented wording: evidence, suspicious, transparency, risk score.
- Avoid claims that the tool can definitively prove model substitution or real model identity.

## Pull Requests

Include:

- What changed
- Why it matters
- How it was tested
- Any privacy or security considerations
