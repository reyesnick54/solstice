# SunRey performance qualification harness

Wave 6 Prompt 16 — reproducible performance, load, stress, and resilience
qualification for production-critical backend systems.

**All results are `ENGINEERING_MEASUREMENT` values. They are not contractual
SLAs.**

## Structure

| Path | Purpose |
| --- | --- |
| `lib/` | Shared stats, environment metadata, report writers, targets |
| `inventory.json` | Production-critical execution path inventory |
| `api/` | Consumer BFF / Platform API HTTP baselines |
| `database/` | Ledger and optional PostgreSQL qualification |
| `blockchain/` | Wrapper around canonical `sunrey-bench` |
| `exchange/` | Order lifecycle and matching |
| `agents/` | Grow My Money orchestration |
| `providers/` | External provider fan-out and timeout behavior |
| `access/` | Access Economy allocation flow |
| `subscription-intelligence/` | Recurring/subscription detection workload |
| `merchant-exchange/` | Placeholder — no canonical service yet |
| `chaos/` | Controlled failure and degradation scenarios |
| `regression/` | CI regression thresholds |
| `results/` | Machine-readable summarized results (gitignored raw logs) |

## Commands

```bash
# Full qualification suite (writes results under performance/results/)
npm run qualify:performance

# Individual suites
npm run qualify:performance -- --suite api
npm run qualify:performance -- --suite database
npm run qualify:performance -- --suite blockchain
npm run qualify:performance -- --suite exchange
npm run qualify:performance -- --suite grow
npm run qualify:performance -- --suite access
npm run qualify:performance -- --suite providers
npm run qualify:performance -- --suite subscription
npm run qualify:performance -- --suite chaos
npm run qualify:performance -- --suite stress

# CI regression (deterministic paths only)
npm run test:performance-regression
```

## Methodology

Follow `docs/performance/benchmark-methodology.md`. Every result must include
environment metadata (commit, CPU, memory, Node version, database mode, crypto
mode). Do not disable security controls or bypass Kernel gating for higher
numbers.

## Existing chain benchmarks

Canonical blockchain performance remains owned by `packages/sunrey-chain/src/perf/`
and `npm run sunrey-bench`. This tree composes those results into the Wave 6
qualification report without creating a second benchmark owner.
