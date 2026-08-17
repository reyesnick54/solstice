# Chunk 58 — SunRey performance, load, soak, and capacity engineering

Implemented on latest `main` after Chunk 55. Chunks 56–57 were not
present on `main`; this chunk measures the existing owners.

Canonical owner remains `packages/sunrey-chain`.

- Harness: `packages/sunrey-chain/src/perf/`
- CLI: `sunrey-bench` (`scripts/sunrey-bench.mjs`)
- Explorer adapter: `packages/sunrey-explorer/src/perf.ts`
- Exchange adapter: `packages/sunrey-exchange/src/perf.ts`
- SDK adapter: `packages/sunrey-sdk/src/perf.ts`
- Custody adapter: `packages/custody/src/perf.ts`

Do not create `packages/sunrey-bench`, `packages/performance`,
`packages/load-test`, or a competing chain.

## Core principle

Performance work measures finalized behavior and resource use. It does
not bypass consensus, CryptoSuite, authorization, policy, asset
reconciliation, oracle validation, custody controls, or exchange
reservations.

Results are `ENGINEERING_MEASUREMENT` values. They are not production
guarantees. Context-free TPS numbers are refused.

## Profiles

`micro`, `single-node`, `four-validator`, `seven-validator`, `rpc`,
`exchange`, `explorer`, `soak`.

CI runs a short sanity combination. Multi-hour soak is
`SUNREY_BENCH_SOAK_MS` / the nightly workflow.

## Latency profiles

`low`, `regional`, and `intercontinental` are laboratory delay models.
They are not geographic measurements.

## Safe optimizations in this chunk

- Fee mempool keeps a `compareForSelection` ordered index.
- Explorer caches finalized projection snapshots and serves immutable
  block/transaction lookups from maps.

Invariant tests cover both paths.
