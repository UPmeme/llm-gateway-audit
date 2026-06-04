# Security Policy

## Reporting Security Issues

Please report security issues privately before public disclosure.

Do not include real API keys, private prompts, account tokens, production logs, or non-redacted gateway reports in public issues.

## Data Handling

`llm-gateway-audit` is designed for redacted local reports:

- API keys are read from an environment variable and are not written to reports.
- Raw prompts are not written to reports.
- Raw response bodies are not written to reports.
- URLs are redacted before reporting credentials, query strings, or fragments.

Users are responsible for reviewing reports before sharing them publicly.

## Scope

This tool provides audit evidence and suspicious risk scoring. It does not guarantee detection of model substitution and does not prove the real upstream model identity.
