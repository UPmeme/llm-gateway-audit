# Changelog

## 0.2.1 - 2026-06-05

- Added `--compare-report <baseline.json> <candidate.json>` for redacted report comparison without sending new requests.
- Added `report-comparison.v1` output.
- Added machine-readable JSON schemas for `audit-report.v1`, `finding.v1`, and `report-comparison.v1`.
- Added `docs/field-test-playbook.md` for safer real-gateway validation.
- Added tests for report comparison.

## 0.2.0 - 2026-06-05

- Added stable report schema metadata with `audit-report.v1` and `finding.v1`.
- Added finding categories and documentation slugs.
- Added `--prompt-file` to read test prompts from local files without storing prompt contents or file paths in reports.
- Added provider compatibility fixtures for OpenAI-standard, LiteLLM-style aliases, one-api style metadata gaps, OpenRouter-style ids, Azure-like omitted model metadata, and stream-compatible chunks.
- Added `docs/finding-schema.md`.
- Added npm package metadata: repository, homepage, and bugs.

## 0.1.2 - 2026-06-05

- Added `--dry-run` to print a redacted request plan without sending a request.
- Added safe JSON config file support with sensitive-field rejection.
- Added `llm-gateway-audit.config.example.json`.
- Added redacted sample reports for honest, model mismatch, missing usage, and fake stream scenarios.
- Added rule-level fixture tests for scoring metadata, usage inconsistency, missing model metadata, empty streams, and URL redaction.
- Updated documentation for config files, dry-run, and sample reports.

## 0.1.1 - 2026-06-04

- Added a TypeScript build pipeline with `npm run build`, `npm run typecheck`, and `npm run verify`.
- Added package lockfile and CI install/build/test workflow.
- Added finding-level risk reason, recommended action, and false-positive notes.
- Added scoring rubric metadata to JSON and Markdown reports.
- Added redaction tests for prompts, API keys, and sensitive URL parts.
- Updated documentation for scoring and build workflow.

## 0.1.0 - 2026-06-04

- Initial CLI for OpenAI-compatible `/v1/chat/completions` audit checks.
- Added redacted JSON and Markdown report output.
- Added checks for model mismatch, usage presence, token consistency, latency, response id, `system_fingerprint`, stream chunk shape, transparency headers, and `base_url` risk.
- Added mock gateway tests for honest, model mismatch, missing usage, and fake stream behavior.
- Added README, Chinese README, SECURITY, CONTRIBUTING, issue templates, and GitHub Actions.
