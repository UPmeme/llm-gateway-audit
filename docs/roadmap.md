# Roadmap

This roadmap keeps `llm-gateway-audit` focused on transparency evidence, not definitive model identity proof.

## Current Focus

- Redacted audit reports
- OpenAI-compatible response metadata checks
- Stream and non-stream structure checks
- Suspicious score and finding explanations
- Safe field testing workflow
- Machine-readable schemas

## Near Term

### Field Validation

- Run harmless-prompt audits against low-risk gateways.
- Record outcomes using `docs/field-validation-log-template.md`.
- Compare official-provider baseline reports against gateway reports with `--compare-report`.
- Validate reports with `--validate-report` before sharing.

### Compatibility

- Add more provider fixtures for common compatible gateways.
- Track schema variants around stream usage, response ids, and model aliasing.
- Improve false-positive notes for documented provider behavior.

### Packaging

- Keep `npm pack --dry-run` clean.
- Publish to npm only after npm identity and package ownership are confirmed.
- Add installation examples after npm publication.

## Later

- Optional baseline comparison workflow that never sends prompts to multiple endpoints automatically.
- More structured Markdown report summaries.
- CI examples for validating redacted reports.
- Additional output formats if users need them.

## Non-Goals

- Do not claim definitive model identity proof.
- Do not upload private prompts, API keys, or raw logs.
- Do not build a hidden model fingerprint classifier as the core claim.
