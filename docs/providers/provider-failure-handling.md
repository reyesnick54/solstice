# Provider failure handling

## Retries

Bounded retries apply to off-chain calls. Financial instructions keep:

- idempotency keys
- provider transaction references
- `SUBMISSION_UNKNOWN` when submission may have occurred

A potentially submitted financial instruction is never blindly repeated.

## Circuit breakers

Off-chain provider health is distinguished as:

- `HEALTHY`
- `DEGRADED`
- `UNAVAILABLE`
- `AUTH_FAILED`
- `SCHEMA_INCOMPATIBLE`
- `RATE_LIMITED`

## Observability

Metrics exist for latency, availability, error count, auth failures,
rate limits, schema failures, retries, and callback replay rejection.
Sensitive payloads are not logged.

## Day-2

Chunk 90 owns provider renewal, credential rotation, outage command,
evidence expiration, provider replacement, and incident command.
Chunk 91 feeds those workflows with engineering runtime status only.
