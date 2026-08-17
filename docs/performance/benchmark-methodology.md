# SunRey benchmark methodology

## Required context

A result is incomplete unless it includes:

- source commit
- hardware profile (arch, CPU count, model, memory)
- OS / container profile
- validator count
- laboratory latency profile (`low`, `regional`, `intercontinental`)
- dataset size
- protocol version
- test duration
- statistics (count, median, p50, p95, p99, min, max, and standard
  deviation where meaningful)

Throughput reports finalized rate, burst rate, and rejection rate.
Mempool acceptance alone is not throughput.

## Profiles

| Profile | What it measures |
| --- | --- |
| `micro` | CryptoSuite costs (labeled separately), mempool admission/selection/dedup |
| `single-node` | Finalized native transfers, wallet/SDK local path, storage, state growth, block-limit study |
| `four-validator` | Consensus phase latency across laboratory delay models |
| `seven-validator` | Required high-load finalized mix plus state-root agreement |
| `rpc` | Public query endpoints and malformed-traffic limits |
| `exchange` | Deterministic book matching and settlement stages |
| `explorer` | Index rate, paused catch-up, query latency, rebuild |
| `soak` | Mixed continuous load, invariants, memory and connection leaks |

## Latency profiles

Laboratory one-way delay models:

- `low` — 0.2 ms
- `regional` — 8 ms
- `intercontinental` — 40 ms

These are not geographic measurements.

## Crypto

Classical development verification and the hybrid simulation path are
benchmarked separately. Chunk 60 real PQC is recorded as unavailable.
Crypto rows are labeled `crypto-not-protocol-tps`.

## What is not optimized away

Benchmarks and optimizations must preserve deterministic serialization,
exact integer arithmetic, consensus safety, authorization semantics,
supply reconciliation, and privacy boundaries.
