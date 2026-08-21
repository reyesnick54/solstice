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

Host: linux, Node v22.14.0, in-process simulation, n=80.

| Operation | Median sample on this host |
| --- | --- |
| posting | 0.016 ms |
| journal lookup | 0.002 ms |
| history pagination | 0.001 ms |
| balance projection | 0.195 ms |

These numbers are an engineering baseline for this workspace only.
They are not a production SLA and must not be cited as capacity.
