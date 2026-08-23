# Phase G Prompt 1 — Exchange core performance baseline

Non-production in-process timings only. This document does **not**
invent SLAs, venue capacity, or latency promises.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Method

`packages/sunrey-exchange/src/production-core/performance.ts`
(`measureExchangeCore`) times a synthetic batch of limit orders:

- order validation
- order submission construction
- matching latency
- book update
- cancellation
- recovery / deterministic replay

Elapsed nanoseconds are observational. They vary by host.

## Test volume

| Dimension | Sandbox volume |
| --- | --- |
| Orders | 64 |
| Environment | in-process Node test harness |
| Live trading | disabled |

## What this is not

- Not a load test
- Not a production SLO
- Not a matching-engine capacity claim
- Not evidence that live trading is ready
