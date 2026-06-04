# Sample Report: Model Mismatch

Target: `https://gateway.example.com`

Requested model: `gpt-4.1-mini`

Response model: `different-model`

Suspicious score: **30/100** (medium)

## Findings

- [high] `model_mismatch`: Response model differs from requested model.
  - Risk reason: A model field mismatch is direct transparency evidence that the gateway returned metadata different from the request.
  - Recommended action: Repeat the audit with stream and non-stream modes, then ask the gateway operator to explain routing and model alias behavior.
  - False positive notes: Some gateways intentionally map aliases to canonical model names; verify whether the provider documents that mapping.

## Boundary

This is suspicious audit evidence. It cannot definitively prove model substitution or the true upstream model.
