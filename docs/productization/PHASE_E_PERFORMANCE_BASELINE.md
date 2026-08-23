# Phase E Grow performance baseline

Non-production sandbox timings only. This document does **not** invent
SLAs, production capacity, or latency promises.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Method

The automated harness `tests/phase-e-performance.test.ts` times one
in-process sandbox customer through:

- PEG / financial snapshot
- opportunity generation
- Growth Plan
- scenario analysis
- proposal generation
- portfolio read
- monitoring cycle

Elapsed milliseconds are observational. They vary by host. They are
written to `/tmp/phase-e-performance-baseline.json` during the test
run and are not production SLAs.

## Test volume recorded

| Dimension | Sandbox volume |
| --- | --- |
| Customers | 1 |
| Proposals | 1 |
| Monitoring cycles | 1 |
| Environment | in-process Consumer BFF + simulation runtime |

## What this is not

- Not a load test
- Not a production SLO
- Not a latency commitment to Lovable or customers
- Not evidence that live brokerage is ready
