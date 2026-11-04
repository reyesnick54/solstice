# HELIOS Engineering Baseline V2 (HEALTH06)

**Program:** `HELIOS_HARDENING_HEALTH06`  
**Schema:** `sunrey.helios.engineering-baseline.v2`  
**Evaluated (UTC):** 2026-11-04T18:13:40.107Z  
**Git SHA:** `fa6d4ab2456371029a4a3d73f77702dddf2f0ab6`  
**Live safety:** PASS

> **Final marker:** _not issued_ (`HELIOS_ENGINEERING_BASELINE_V2_BLOCKED` — mandatory gates did not all pass)

## Objective

Establish a clean engineering baseline before the next major HELIOS intelligence wave. **No new product features** — qualification and evidence only.

## Verified posture

| Check | Expected |
| --- | --- |
| `LIVE_TRADING_ENABLED` | `false` |
| `production_authorized` (authority map) | `false` |

## Scorecard

| Dimension | Status | Gates | Detail |
| --- | --- | --- | --- |
| type safety | PASS | helios_strict_scoped_typecheck | All contributing gates passed |
| architecture integrity | PASS | live_trading_disabled, production_authorized_disabled, architecture_lint, production_safety, agent_permissions | All contributing gates passed |
| formal assurance | PASS | formal_extended | All contributing gates passed |
| memory stability | FAIL | bench_nightly, memory_soak | memory_soak:  > sunrey@0.1.0 sunrey-bench > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/sunrey-bench.mjs soak --soak-ms 120000 --json packages/sunrey-chain/perf/baseline/nightly-soak.json SunRey bench soak — ENGINEERING_MEASUREMENT commit fa6d4ab2456371029a4a3d73f77702dddf2f0ab6 hardware x64 4cpu Intel(R) Xeon(R) Processor os linux node v22.23.4 container=false validators=4 latency_profile=low dataset=14499 protocol=sunrey.protocol.v1 duration_ms=120000 - soak/mixed_continuo |
| determinism | PASS | execution_twin, fuzz_extended | All contributing gates passed |
| restart safety | FAIL | restart_recovery | restart_recovery:  > sunrey@0.1.0 qualify:wave9:dr > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qualify-wave9.mjs --suite database-failure,backup-restore,full-stack-restart [qualify:wave9] profile=full suites=database-failure,backup-restore,full-stack-restart [qualify:wave9] running database-failure... [qualify:wave9] database-failure: ENVIRONMENT_LIMITED (10ms) [qualify:wave9] running backup-restore... [qualify:wave9] backup-restore: TARGET_NOT_MET (0ms) [qualify:wave9] running |
| test coverage | PASS | normal_ci, aaf_v2_qualification, earn01_earn12_qualification, native_assimilation_qualification, strategy_lab, provider_conformance | All contributing gates passed |
| release reproducibility | PASS | database_migrations, helios_release_candidate | All contributing gates passed |

## Mandatory gates

| Gate | Status | Detail |
| --- | --- | --- |
| `live_trading_disabled` | PASS | actual=false as const |
| `production_authorized_disabled` | PASS | actual=false |
| `normal_ci` | PASS | verified separately via scripts/helios-health06-normal-ci.mjs on this SHA |
| `helios_strict_scoped_typecheck` | PASS | HELIOS strict scoped typecheck: no errors in HELIOS intelligence surface |
| `architecture_lint` | PASS | ok |
| `production_safety` | PASS | check-production-safety + deployment posture ok |
| `aaf_v2_qualification` | PASS | ok |
| `earn01_earn12_qualification` | PASS | ok (12 files) |
| `native_assimilation_qualification` | PASS | HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED; native tests ok |
| `strategy_lab` | PASS | ok |
| `execution_twin` | PASS | ok |
| `agent_permissions` | PASS | ok |
| `provider_conformance` | PASS | ok |
| `database_migrations` | PASS | ok |
| `fuzz_extended` | PASS | ok |
| `formal_extended` | PASS | ok |
| `bench_nightly` | PASS | ok |
| `memory_soak` | FAIL |  > sunrey@0.1.0 sunrey-bench > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/sunrey-bench.mjs soak --soak-ms 120000 --json packages/sunrey-chain/perf/baseline/nightly-soak.json SunRey bench soak — ENGINEERING_MEASUREMENT commit fa6d4ab2456371029a4a3d73f77702dddf2f0ab6 hardware x64 4cpu Intel(R) Xeon(R) Processor os linux node v22.23.4 container=false validators=4 latency_profile=low dataset=14499 protocol=sunrey.protocol.v1 duration_ms=120000 - soak/mixed_continuo |
| `restart_recovery` | FAIL |  > sunrey@0.1.0 qualify:wave9:dr > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qualify-wave9.mjs --suite database-failure,backup-restore,full-stack-restart [qualify:wave9] profile=full suites=database-failure,backup-restore,full-stack-restart [qualify:wave9] running database-failure... [qualify:wave9] database-failure: ENVIRONMENT_LIMITED (10ms) [qualify:wave9] running backup-restore... [qualify:wave9] backup-restore: TARGET_NOT_MET (0ms) [qualify:wave9] running |
| `helios_release_candidate` | PASS | postgres unavailable; helios:h34:release-package:fast ok |

## Blockers

- memory_soak:  > sunrey@0.1.0 sunrey-bench > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/sunrey-bench.mjs soak --soak-ms 120000 --json packages/sunrey-chain/perf/baseline/nightly-soak.json SunRey bench soak — ENGINEERING_MEASUREMENT commit fa6d4ab2456371029a4a3d73f77702dddf2f0ab6 hardware x64 4cpu Intel(R) Xeon(R) Processor os linux node v22.23.4 container=false validators=4 latency_profile=low dataset=14499 protocol=sunrey.protocol.v1 duration_ms=120000 - soak/mixed_continuo
- restart_recovery:  > sunrey@0.1.0 qualify:wave9:dr > node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/qualify-wave9.mjs --suite database-failure,backup-restore,full-stack-restart [qualify:wave9] profile=full suites=database-failure,backup-restore,full-stack-restart [qualify:wave9] running database-failure... [qualify:wave9] database-failure: ENVIRONMENT_LIMITED (10ms) [qualify:wave9] running backup-restore... [qualify:wave9] backup-restore: TARGET_NOT_MET (0ms) [qualify:wave9] running

## Scope notes

- **HELIOS strict scoped typecheck** covers `packages/platform/src/helios`, Strategy Lab, Agentic Capital Mesh, venue conformance, HELIOS external-data ports, and `tests/helios-*` — independent of repository-wide TypeScript debt gated elsewhere in CI.
- **Extended assurance** (fuzz extended, formal extended, bench nightly, memory soak) must be executed locally or via their dedicated workflows; results are recorded here only when the HEALTH06 runner completes them successfully.
- Do **not** treat this document as live-pilot authorization or production activation.
