# Phase G Exchange / Chain performance baseline

Non-production sandbox timings only. This document does **not** invent
SLAs, production capacity, or latency promises.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Method

The automated harness `tests/phase-g-performance.test.ts` times one
in-process `DigitalAssetLifecycle` through:

- market list
- ticker
- order book
- order preview
- order submission / matching / settlement
- wallet read
- chain RPC / Explorer projection
- transaction submission (simulated deposit)
- market-data stream snapshot
- RPC / transaction-history reads

Elapsed milliseconds are observational. They vary by host. They are
written to `docs/productization/phase-g-performance-baseline.json`
during the test run and are not production SLAs.

Load samples are sequential local calls (`loadRead`), not destructive
stress against external services.

## Test volume recorded

| Dimension | Sandbox volume |
| --- | --- |
| Participants | 1 |
| Buy submissions | 1 |
| Market-list iterations | 40 |
| Stream connections (local) | 8 |
| RPC reads | 16 |
| Environment | in-process Exchange productization lifecycle |

## What this is not

- Not a production SLO
- Not a latency commitment to Lovable or customers
- Not evidence that live Exchange or mainnet is ready
- Not a destructive external stress test
