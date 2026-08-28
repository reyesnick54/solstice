# SunRey API preview: external Grok research

The external AI preview is disabled unless explicitly enabled. It is
research-only connectivity and does not enable financial production, banking,
payments, exchange execution, or Execution Authority.

```text
SUNREY_EXTERNAL_AI_PREVIEW_ENABLED=true
XAI_BASE_URL=https://api.x.ai
XAI_RESPONSES_PATH=/v1/responses
XAI_MODEL=<configured-supported-grok-model>
XAI_TIMEOUT_MS=30000
XAI_MAX_OUTPUT_TOKENS=<bounded-token-limit>
XAI_CREDENTIAL_REF=secret://cloud-run/xai-api-key
XAI_WEB_SEARCH_ENABLED=true
XAI_X_SEARCH_ENABLED=true
```

In Cloud Run, bind the Google Secret Manager secret named `xai-api-key` to
the container environment variable `SUNREY_SECRET_XAI_API_KEY`, which is the
binding consumed by the `cloud-run` SecretProvider. Application code receives only the reference
`secret://cloud-run/xai-api-key`; the value must not be committed, logged, or
included in requests, traces, provenance, or API responses.

The only supported external task is public
`MARKET_OPPORTUNITY_RESEARCH`. Public market context is sent to Grok, then
validated candidates are passed to SunRey's Growth Orchestrator. Customer
personalization happens after that boundary.
