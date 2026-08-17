# SunRey soak testing

Default CI soak is short (`SUNREY_BENCH_SOAK_MS`, default 250 ms in
library code and 80 ms in CI sanity).

The manual / nightly profile keeps submitting a mixed workload,
finalizing blocks, querying the in-process RPC, exercising oracle and
productive activity, and sampling memory and disk.

## Invariants at checkpoints

- replica state roots equal
- native asset positions reconcile (non-negative integer holdings)
- no duplicate settlements
- no duplicate MoonRey issuance
- Explorer lag is zero when the adapter ran
- no signer conflicts
- no growing unreconciled custody mismatch
- RSS growth stays under the configured engineering threshold
- closed clients release P2P, RPC, pool, and subscription handles

## Nightly

`.github/workflows/sunrey-bench-nightly.yml` is a separate workflow.
It is not part of the seven-stage default CI.
