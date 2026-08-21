# Phase C performance baseline

Non-production, in-process sandbox measurements. This is not a hosted
load test and not an SLA.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`

## Methodology

`tests/phase-c-performance.test.ts` constructs a FrozenClock Phase C
world (accounts, payments, treasury financial control) and records
wall-clock samples with `performance.now()`:

- ledger balance reads
- FX quote creation
- reconciliation batches with distinct inputs
- optional transfer samples when a second account is opened

Median and max milliseconds are written to
`docs/productization/PHASE_C_PERFORMANCE_BASELINE.json` when that test
runs. Treat the JSON as the latest local observation, not a contract.

## What is not measured

- PostgreSQL under concurrent writers
- Network hops to a real provider
- Card authorization under processor latency
- Multi-tenant production traffic

Do not invent SLAs from these numbers.

## Latest local observation

Recorded by `tests/phase-c-performance.test.ts` on this Phase C branch:

| Path | n | median_ms | max_ms |
| --- | ---: | ---: | ---: |
| balance_reads | 20 | 0.003 | 0.136 |
| fx_quotes | 20 | 0.234 | 1.146 |
| reconciliation_batch | 10 | 0.074 | 0.768 |
| transfer_samples | 5 | 0.314 | 2.845 |
