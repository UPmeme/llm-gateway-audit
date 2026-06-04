# npm Publish Checklist

Use this checklist before publishing `llm-gateway-audit` to npm.

## Identity Boundary

- Confirm which public identity owns the npm package.
- Confirm package metadata does not expose private identity links.
- Confirm `package.json` `repository`, `homepage`, and `bugs` point only to the intended GitHub identity.

## Package Checks

```bash
npm run verify
npm pack --dry-run
npm publish --dry-run
```

Review the dry-run file list:

- `dist/`
- `src/`
- `docs/`
- `schemas/`
- `examples/`
- `README.md`
- `README.zh-CN.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `LICENSE`
- `llm-gateway-audit.config.example.json`

## Safety Checks

```bash
rg -n "sk-[A-Za-z0-9]{12,}|github_pat_|ghp_|promptHash|stableHash|guaranteed detection|100%" .
```

Do not publish if the scan finds real credentials, private prompts, private logs, or overclaiming language.

## Publish

Only publish after confirming npm account, package name, and identity boundary.

```bash
npm publish --access public
```
