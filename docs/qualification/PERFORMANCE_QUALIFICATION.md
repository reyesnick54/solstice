# SunRey Performance Qualification — Wave 6 Prompt 16

**Class:** `ENGINEERING_MEASUREMENT` / `ENGINEERING_QUALIFICATION_TARGET`

This document records reproducible performance, load, stress, and resilience
qualification for SunRey production-critical backend paths. These are internal
engineering observations, **not contractual SLAs**.

## Scope

| Area | Harness | Status |
| --- | --- | --- |
| Performance inventory | `performance/inventory.json` | `BENCHMARKED` |
| Consumer BFF / API HTTP | `performance/api/baseline.ts` | `BENCHMARKED` |
| Ledger / database (in-process) | `performance/database/baseline.ts` | `TARGET_MET` |
| SunRey Chain (canonical `sunrey-bench`) | `performance/blockchain/run.ts` | `BENCHMARKED` |
| Exchange order lifecycle | `performance/exchange/baseline.ts` | `TARGET_MET` |
| Grow My Money orchestration | `performance/agents/grow-baseline.ts` | `TARGET_MET` |
| Access Economy allocation | `performance/access/allocation-baseline.ts` | `TARGET_MET` |
| External provider fan-out | `performance/providers/fanout-baseline.ts` | `TARGET_MET` |
| Subscription intelligence | `performance/subscription-intelligence/baseline.ts` | `BENCHMARKED` |
| Controlled chaos / degradation | `performance/chaos/scenarios.ts` | `ENVIRONMENT_LIMITED` |
| Seven-validator stress | `scripts/qualify-performance.mjs` (`stress`) | `BENCHMARKED` |
| Sustained soak | `scripts/qualify-performance.mjs` (`soak`) | `ENVIRONMENT_LIMITED` |
| Merchant Exchange | `performance/merchant-exchange/README.md` | `NOT_TESTED` |
| PostgreSQL RC qualification | `npm run qualify:backend-db` | `ENVIRONMENT_LIMITED` (separate harness) |

## Method

1. Run `npm run qualify:performance` on the target host.
2. Results are written to `performance/results/wave6-prompt16-<timestamp>/summary.json`
   plus per-suite JSON files.
3. CI enforces conservative deterministic regression envelopes via
   `npm run test:performance-regression`.
4. Canonical blockchain methodology remains in `docs/performance/benchmark-methodology.md`
   and `npm run sunrey-bench`.

Security controls, Kernel gating, and authorization semantics were **not**
disabled for higher benchmark numbers.

## Environment (executed run)

Recorded in `performance/results/wave6-prompt16-2026-08-31T16-27-43-672Z/summary.json`:

| Field | Value |
| --- | --- |
| Commit | `8f4683320e0a0957c8d623ce881634577ac0bff6` |
| Date (UTC) | 2026-08-31T16:27–16:28 |
| Node | v22.14.0 |
| OS / arch | linux / x64 |
| CPU | 4 × Intel Xeon |
| RAM | 15.64 GiB total |
| `ENVIRONMENT` | `simulation` |
| Database mode | in-process (PostgreSQL via `qualify:backend-db` not duplicated here) |
| Crypto mode | `HYBRID_SIMULATION` (`@noble/post-quantum@0.5.4`) |
| Validator count (chain stress) | 7 |

## Engineering qualification targets

Sources: `docs/operations/production-slos.md`,
`docs/productization/SUNREY_LEDGER_PERFORMANCE_BASELINE.md`,
`docs/access/ACCESS_V1_LAUNCH_REPORT.md`, `performance/regression/thresholds.json`.

All targets are labeled `ENGINEERING_QUALIFICATION_TARGET`.

| Domain | Target class | Envelope |
| --- | --- | --- |
| API authenticated read | p95 < 500 ms, p99 < 1000 ms | phase-b baseline |
| Ledger posting | median < 50 ms | SUNREY_LEDGER_PERFORMANCE_BASELINE |
| Ledger lookup | median < 20 ms | SUNREY_LEDGER_PERFORMANCE_BASELINE |
| Access overview | p99 < 1 ms | ACCESS V1 certification |
| Access search/quote | p99 < 50 ms | ACCESS V1 certification |
| Exchange order ingress | p99 < 100 ms | phase-g baseline |
| Grow proposal creation | p99 < 5000 ms | wave6 internal |

## Results summary

### API (representative flows, n=40 each)

Health is recorded separately and is **not** treated as representative application performance.

| Flow | p50 (ms) | p95 (ms) | p99 (ms) | Error rate |
| --- | ---: | ---: | ---: | ---: |
| `/health` | 0.37 | 1.69 | 14.59 | 0 |
| `/api/v1/me/bootstrap` | 0.44 | 0.71 | 2.12 | 0 |
| `/api/v1/me/home` | 0.90 | 1.35 | 3.17 | 0 |
| `/api/v1/accounts` | 0.33 | 0.38 | 0.59 | 0 |
| `/api/v1/grow/snapshot` | 0.39 | 0.75 | 1.09 | 0 |
| `/api/v1/access/overview` | 0.74 | 1.18 | 2.60 | 0 |
| `/api/v1/exchange/markets` | 0.31 | 0.37 | 0.48 | 0 |

Concurrency (`/api/v1/me/home`):

| Concurrency | p99 (ms) | Throughput (req/s) | Errors |
| --- | ---: | ---: | ---: |
| 10 | 23.76 | ~526 | 0 |
| 50 | 59.89 | ~833 | 0 |
| 100 | 112.48 | ~909 | 0 |

### Database / ledger (in-process, n=80)

| Operation | Median (ms) | Status |
| --- | ---: | --- |
| posting | 0.016 | `TARGET_MET` |
| journal lookup | 0.002 | `TARGET_MET` |
| history pagination | 0.001 | `BENCHMARKED` |
| concurrent writes (10×40) | 0.012 p50 | `BENCHMARKED` |

PostgreSQL qualification: use `npm run qualify:backend-db` (not re-run in this harness).

### Blockchain (seven-validator, low latency profile)

| Metric | Engineering measurement |
| --- | --- |
| Sustained finalized tx/s | 8521 (sanity profile case) |
| Finality p99 (7v low E2E) | ~1.80 ms |
| State-root agreement | equal |
| Rejected (mixed load) | 0 |

Stress saturation probe: **13363 finalized tx/s** sustained on this host (48-tx burst, 0 rejected).

Crypto rows remain labeled separately (`crypto-not-protocol-tps` per methodology).

### Exchange (simulated settlement)

| Orders | Ingress p99 (ms) | Matching p99 (µs-scale) |
| ---: | ---: | ---: |
| 100 | < 0.1 | measured |
| 500 | < 0.1 | measured |
| 1000 | < 0.1 | measured |

Simulated settlement only — not regulated live settlement.

### Grow My Money

| Stage | p99 (ms) | Category |
| --- | ---: | --- |
| Opportunity ingestion | 2.81 | deterministic backend |
| Proposal creation | 2.09 | deterministic backend |
| S3M inference (simulator) | 1.62 | external AI (simulated) |

### Access Economy

| Path | p99 (ms) | Status |
| --- | ---: | --- |
| Overview read | 0.009 | `TARGET_MET` |
| Provider search | 0.053 | `TARGET_MET` |
| Provider quote | 0.026 | `TARGET_MET` |
| Wave1 allocation (50 samples) | sub-ms median | `BENCHMARKED` |
| Concurrency 50×250 | no errors observed | `BENCHMARKED` |

### Provider fan-out

| Scenario | p99 (ms) | Notes |
| --- | ---: | --- |
| Four-domain parallel (macro/fx/markets/filings) | 0.98 | fixture adapters |
| Timeout provider | 0.12 | fails fast; does not block aggregate |
| Partial provider success | measured | degraded but completes |

### Subscription intelligence

| History size | Detect latency (ms) | Complexity note |
| ---: | ---: | --- |
| 50 | sub-ms | linear scan acceptable |
| 200 | sub-ms | linear scan acceptable |
| 500 | sub-ms | monitor at scale |
| 1000 | sub-ms | no superlinear blow-up observed |

### Chaos / resilience

| Scenario | Outcome |
| --- | --- |
| Healthy baseline | `TARGET_MET` |
| Provider-down preview | HTTP degradation without ledger ambiguity |
| Database unavailable | `ENVIRONMENT_LIMITED` — requires controlled PostgreSQL stop |
| Validator unavailable | `ENVIRONMENT_LIMITED` — use `sunrey-bench` latency profiles |

### Soak

`ENVIRONMENT_LIMITED` in default CI/cloud run. Set `SUNREY_SOAK_MS>=60000` on a dedicated host
for sustained soak per `docs/performance/soak-testing.md`.

## Bottlenecks and fixes

| Issue | Fix | Before / after |
| --- | --- | --- |
| Merge corruption in `packages/external-data/src/plane.ts` | Renamed wave5 monitor; unified `setProviderState` | providers suite failed → `TARGET_MET` |
| Merge corruption in `coverage.ts` / `wave6/coverage.ts` | Split opportunity coverage report | import errors → suites run |
| Missing `npm install` (`@noble/post-quantum`) | `npm install` on agent host | blockchain failed → `BENCHMARKED` |
| `http.ts` missing `)` | Fixed `Promise.resolve(...)` close | API/chaos failed → run |

No speculative performance rewrites were applied.

## Capacity limits observed (this host)

- API home endpoint begins latency growth above ~100 concurrent clients (p99 ~112 ms at 100).
- Seven-validator in-process throughput plateau near **13k finalized tx/s** on 4 vCPU lab host.
- Long soak and production PostgreSQL load require dedicated environment (`ENVIRONMENT_LIMITED`).

## Unqualified areas

| Area | Reason |
| --- | --- |
| Merchant Exchange | No canonical service implementation |
| Live AI provider latency | Simulator only in CI; no live credentials in normal CI |
| Production PostgreSQL under load | Use `qualify:backend-db`; not duplicated here |
| Multi-hour soak | `SUNREY_SOAK_MS` default too low for cloud agent window |
| Websocket/stream fan-out | Not isolated in this prompt's harness |
| Public-mainnet scale | Simulation validators only |

## Commands

```bash
npm install
npm run qualify:performance
npm run test:performance-regression
npm run sunrey-bench -- sanity
npm run qualify:backend-db   # PostgreSQL RC qualification (separate)
```

## Machine-readable artifacts

- `performance/results/wave6-prompt16-2026-08-31T16-27-43-672Z/summary.json`
- Per-suite JSON alongside summary in the same directory
- `performance/inventory.json`
- `performance/regression/thresholds.json`
