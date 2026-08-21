# Ledger performance baseline

Non-production measurements for the canonical Ledger. These are not
latency SLAs and must not be treated as production guarantees.

Recorded by `tests/phase-c-01-ledger-perf.test.ts` on the local
simulation host. No live providers.

## Method

In-process `Ledger.postJournal` against the simulated funding source,
then journal lookup, history pagination, and posted-balance projection.
Eighty samples after construction. The test fails only on a severe
local regression (tens of milliseconds), not ordinary jitter.

## Expected local envelope

| Operation | Envelope used to detect regression |
| --- | --- |
| posting | well under 50 ms typical |
| journal lookup | well under 20 ms typical |
| history pagination | well under 20 ms typical |
| balance projection | well under 20 ms typical |

Absolute numbers depend on the host. The checked invariant is that a
local in-process posting loop completes without approaching those
failure thresholds for the median sample.

## Representative local samples

Filled after the Phase C Prompt 1 performance test runs on this host.
Not an SLA.
