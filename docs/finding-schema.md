# Finding Schema

`llm-gateway-audit` reports findings using a stable JSON shape.

## `finding.v1`

```json
{
  "schemaVersion": "finding.v1",
  "code": "model_mismatch",
  "category": "model",
  "severity": "high",
  "score": 30,
  "message": "Response model differs from requested model.",
  "evidence": {
    "requestedModel": "gpt-4.1-mini",
    "responseModel": "different-model"
  },
  "docsSlug": "model-mismatch",
  "riskReason": "A model field mismatch is direct transparency evidence that the gateway returned metadata different from the request.",
  "recommendedAction": "Repeat the audit with stream and non-stream modes, then ask the gateway operator to explain routing and model alias behavior.",
  "falsePositiveNotes": "Some gateways intentionally map aliases to canonical model names; verify whether the provider documents that mapping."
}
```

## Stable Fields

- `schemaVersion`: currently `finding.v1`
- `code`: machine-readable finding code
- `category`: broad group such as `model`, `usage`, `stream`, `latency`, `privacy`, `transparency`, or `configuration`
- `severity`: `info`, `low`, `medium`, or `high`
- `score`: additive suspicious score contribution
- `message`: short human-readable finding
- `evidence`: redacted structured evidence
- `docsSlug`: stable documentation slug derived from `code`
- `riskReason`: why the signal matters
- `recommendedAction`: what to do next
- `falsePositiveNotes`: common benign explanations

## Boundary

Findings are audit evidence and transparency signals. They cannot definitively prove model substitution or the true upstream model.
