# Chunk 58 — SunRey performance engineering

`sunrey-bench` is the repeatable performance-engineering platform for
SunRey. It lives at `packages/sunrey-chain/src/perf` and is invoked as:

```
npm run sunrey-bench -- sanity
npm run sunrey-bench -- seven-validator --json artifacts/seven.json
SUNREY_BENCH_SOAK_MS=3600000 npm run sunrey-bench -- soak
```

Every machine-readable report includes source commit, hardware, OS or
container profile, validator count, laboratory latency profile, dataset
size, protocol version, duration, and statistics. Context-free TPS
numbers are not published.

These results are development and engineering measurements. They are
not production guarantees.

See [benchmark methodology](./benchmark-methodology.md),
[capacity report](./capacity-report.md), and
[soak testing](./soak-testing.md).
