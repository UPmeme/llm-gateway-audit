# Changelog

## 0.1.0 - 2026-06-04

- Initial CLI for OpenAI-compatible `/v1/chat/completions` audit checks.
- Added redacted JSON and Markdown report output.
- Added checks for model mismatch, usage presence, token consistency, latency, response id, `system_fingerprint`, stream chunk shape, transparency headers, and `base_url` risk.
- Added mock gateway tests for honest, model mismatch, missing usage, and fake stream behavior.
- Added README, Chinese README, SECURITY, CONTRIBUTING, issue templates, and GitHub Actions.
