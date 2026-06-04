# Sample Report: Fake Stream

Target: `https://gateway.example.com`

Requested model: `gpt-4.1-mini`

Suspicious score: **25/100** (medium)

## Findings

- [high] `stream_malformed_chunks`: Stream contained malformed SSE JSON chunks.
  - Risk reason: Malformed SSE chunks can break client compatibility and may indicate nonstandard stream transformation.
  - Recommended action: Save the redacted audit report and compare stream behavior against OpenAI-compatible SSE format.
  - False positive notes: Some gateways send comments or keepalive lines; those should not be counted as malformed unless JSON data chunks are invalid.
