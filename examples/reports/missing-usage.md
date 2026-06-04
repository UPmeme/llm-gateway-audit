# Sample Report: Missing Usage

Target: `https://gateway.example.com`

Requested model: `gpt-4.1-mini`

Suspicious score: **20/100** (medium)

## Findings

- [medium] `usage_missing`: Non-stream response did not include usage.
  - Risk reason: Missing usage prevents independent review of token accounting and billing-related behavior.
  - Recommended action: Repeat with non-stream mode and request documented usage reporting from the gateway operator.
  - False positive notes: Some providers omit usage for streaming or special endpoints; this finding only scores non-stream responses.
