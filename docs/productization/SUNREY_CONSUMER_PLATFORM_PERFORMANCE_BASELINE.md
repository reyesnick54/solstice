# Consumer platform performance baseline

Non-production measurements for foundational read APIs. These are not
latency SLAs and must not be treated as production guarantees.

Recorded by `tests/phase-b-perf.test.ts` on the local simulation
runtime with sandbox personas. No live providers.

## Method

Start `startConsumerPlatform`, login `alex-ready`, then time:

- `GET /health`
- `GET /v1/consumer/bootstrap`
- `GET /v1/consumer/home`
- `GET /v1/consumer/accounts`

Each path is sampled several times after one warmup request. The test
fails only on severe architectural regression (multi-second local
reads), not on ordinary jitter.

## Expected local envelope

| Route | Envelope used to detect regression |
| --- | --- |
| health | well under 250 ms typical |
| bootstrap | well under 500 ms typical |
| home | well under 500 ms typical |
| accounts | well under 500 ms typical |

Absolute numbers depend on the host. The checked invariant is that a
cold local read of these four routes completes in the same process
without approaching a one-second failure threshold for the median
sample.

## Representative local samples (2026-08-21)

Recorded on the Cloud Agent simulation host. Not an SLA.

| Route | Sample (ms) |
| --- | ---: |
| health | 1.25 |
| bootstrap | 1.45 |
| home | 1.81 |
| accounts | 1.52 |

These values detect severe architectural regressions later. They do
not authorize production latency claims.
