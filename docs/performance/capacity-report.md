# SunRey capacity report

**Class:** `ENGINEERING_ESTIMATE` / `ENGINEERING_MEASUREMENT`

This report records development-host results from `sunrey-bench`.
Do not treat these ceilings as production guarantees. Context-free
TPS numbers are refused.

## Host profile

Captured on the first sanity run of this branch:

| Field | Value |
| --- | --- |
| Source commit | `08f0c329fe25a571da29ba2cce28c47903777507` |
| Hardware | x64, 4 CPU, Intel Xeon, 16 GiB |
| OS / runtime | linux, Node v22.14.0 |
| Protocol | `sunrey.protocol.v1` |
| Result class | `ENGINEERING_MEASUREMENT` |

Re-run `npm run sunrey-bench -- sanity` on the target host before
quoting numbers. Compact JSON lives at
`packages/sunrey-chain/perf/baseline/manifest.json`.

## Disk growth estimates

Engineering bytes-per-object hints used for planning only:

| Object | Estimated bytes |
| --- | ---: |
| Block | 1024 |
| Transaction | 320 |
| Oracle fact | 256 |
| Productive contribution | 384 |

These are not storage contracts.

## Block / resource limits

The candidate study varies max block bytes, max execution units, and a
transaction-count cap. Protocol defaults remain the development
schedule in `developmentBlockLimits()`. A faster candidate is not a
reason to change defaults.

## Required seven-validator load

Laboratory in-process profile (`seven-validator`, modeled `low`
latency, **not** a geographic measurement):

| Metric | Engineering measurement |
| --- | --- |
| Submitted / accepted / finalized / rejected | 48 / 48 / 48 / 0 |
| Finalized throughput (sustained) | 6156 finalized tx/s on this host |
| Finality p50 / p95 / p99 | 1.188 ms / 7.475 ms / 7.475 ms |
| Round changes | 0 |
| State-root agreement | equal |
| RSS / CPU (process sample) | 118 MiB / 12 ms user |

## Modeled consensus finality (4 validators)

Added modeled delay only. `geographicClaim=false`.

| Latency profile | End-to-end finality median | p95 |
| --- | ---: | ---: |
| low | 1.328 ms | 7.254 ms |
| regional | 40.109 ms | 40.125 ms |
| intercontinental | 200.105 ms | 200.109 ms |

## Mixed economic load

The seven-validator mixed workload includes SunRey transfer, MoonRey
transfer, asset lock, exchange settlement, oracle observation,
productive claim, machine commerce, and low-frequency governance.
Replica available balances agreed. Soak (80 ms CI window) submitted
106, finalized 106, rejected 0.

## RPC

In-process public RPC load (90 requests) and malformed abuse (40):

| Endpoint | median | p95 |
| --- | ---: | ---: |
| block | 1.4 us | 56.1 us |
| transaction | 1.3 us | 9.3 us |
| account | 3.6 us | 81.5 us |
| asset holdings | 2.9 us | 14.6 us |
| fees | 26.4 us | 201.8 us |
| oracle facts | 2.9 us | 51.0 us |
| productive graph | 934 ns | 12.7 us |
| validator set | 1.4 us | 7.8 us |
| interop client | 1.8 us | 52.4 us |

Aggregate accepted 90/90, error rate 0. Malformed traffic: 40/40
rejected, `protectiveLimitsHeld=true`, no RSS collapse.

## Exchange

Deterministic generated book, exact listing precision:

| Case | median | notes |
| --- | ---: | --- |
| order ingress | 87.6 us | 12 orders |
| price-time matching | 88.2 us | 4 trades, 2 cancels |
| settlement stages | 61.0 us | DVP + reconciliation, no duplicate settlements |
| order-book depth | 692 ns | 1 bid / 1 ask remaining |
| batch auction | 132 us | uniform-price empty book |

## Explorer catch-up

Indexer paused, 24 finalized blocks generated, then resumed:

| Metric | Engineering measurement |
| --- | --- |
| Lag before / after | 20 / 0 |
| Catch-up | 53.3 us to zero lag |
| Query median | 130.3 us |
| Rebuild | 189 us |

## Oracle / productive / machine / interop / custody

| Suite | Case | median |
| --- | --- | ---: |
| oracle | observation + signature verify | 1.011 ms |
| oracle | aggregation | 46.2 us |
| productive | claim verification | 255.5 us |
| productive | anti-double-count fingerprint | 86.4 us |
| machine | offer/purchase/escrow/meter/settle | 9.747 ms |
| interop | header verification | 17.1 us |
| custody | chain submission (no human wait) | 11.1 us |

## Soak / memory / connections

CI sanity soak is 80 ms. RSS delta 393 KiB, below the 64 MiB flag.
Closed RPC and event-subscription clients released resources.
Multi-hour soak is `SUNREY_BENCH_SOAK_MS` / the nightly workflow.

## Optimizations performed

1. `FeeMempool` ordered index — selection still `compareForSelection`.
2. Explorer projection and block caches — projection hash unchanged.

Invariant tests cover both paths. Consensus, CryptoSuite,
authorization, policy, reconciliation, oracle validation, custody
controls, and exchange reservations were not bypassed.
