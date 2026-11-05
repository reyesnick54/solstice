# HELIOS HEALTH07 — Memory soak final qualification

**Qualification marker:** `HELIOS_MEMORY_SOAK_QUALIFIED`

**Program:** `HELIOS_HARDENING_HEALTH07`

## Problem statement

HEALTH05 bounded hot retention and unit tests emit `HELIOS_MEMORY_SOAK_QUALIFIED`, but HEALTH06 still failed the **integrated** gate:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  scripts/sunrey-bench.mjs soak \
  --soak-ms 120000 \
  --json packages/sunrey-chain/perf/baseline/nightly-soak.json
```

On commit `fa6d4ab`, `MEMORY_GROWTH_BUDGET` used **start-to-end RSS delta** (~308 MiB) and failed. HEALTH05 plateau logic on `main` fixed chain-only soak, but qualification required **phase-aware trend analysis**, **5 s instrumentation**, and **integrated HELIOS store** evidence—not unit tests alone.

## Reproduction (canonical HEALTH06 command)

```bash
npm ci
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  scripts/sunrey-bench.mjs soak \
  --soak-ms 120000 \
  --json packages/sunrey-chain/perf/baseline/nightly-soak.json
```

**Pass criteria:** exit code `0`; invariants `MEMORY_GROWTH_BUDGET` and `MEMORY_STEADY_STATE_TREND` ok.

**Observed on current `main` (engineering host, chain + SDK soak):**

| Signal | Typical steady-state behavior |
| --- | --- |
| RSS start→end | ~180–200 MiB (V8/allocator mapping during warmup) |
| Rolling RSS median Δ (steady) | ≤ ~16 MiB |
| Heap plateau Δ (early vs late steady max) | ≤ 64 MiB budget; often negative after GC |
| Classification | `RSS_RETENTION` (allocator RSS, bounded heap/objects) |

Integrated HELIOS plane (optional):

```bash
SUNREY_BENCH_HELIOS_INTEGRATED=1 npm run sunrey-bench -- soak --soak-ms 120000
```

## Instrumentation (≥ every 5 s)

Implemented in `packages/sunrey-chain/src/perf/memory-instrumentation.ts` and attached to soak snapshots:

| Signal | Source |
| --- | --- |
| RSS, heap used/total, external, ArrayBuffers | `process.memoryUsage()` |
| Active handles, timers, requests | `process.getActiveResourcesInfo()` |
| Event listener count | `process.eventNames()` |
| Phase label | `WARMUP` / `STEADY_STATE` / `COOLDOWN` |
| Fee receipt hot/sealed | `FeeEngine.feeReceiptRetentionStats()` |
| Productive object/claim/fact/receipt counts | `ProductiveEconomyEngine` |
| HELIOS observation / twin / strategy counters | `packages/platform/.../memory-soak-snapshot.ts` (when `SUNREY_BENCH_HELIOS_INTEGRATED=1`) |

## Trend algorithm (steady-state, not startup RSS)

`packages/sunrey-chain/src/perf/memory-trend-analysis.ts`:

1. Discard configurable **warmup** (default 30 s) and **cooldown** (default 10 s).
2. Compute **rolling RSS median** over steady samples.
3. Record **Theil–Sen slopes** for heap and RSS (diagnostics; robust to GC spikes).
4. **Primary pass/fail:** late vs early steady **heap max plateau** ≤ 64 MiB; rolling RSS median Δ ≤ 128 MiB (`DEFAULT_MEMORY_TREND_CONFIG.maxRollingRssMedianDeltaBytes`).
5. **Retained objects:** tail-plateau stability for bounded stores (fee hot window, productive slots, HELIOS caps).
6. **High-water RSS** and start→end RSS reported separately; large startup RSS with flat steady trends classifies as `RSS_RETENTION`, not failure.

## Repeated qualification

**CI (practical):**

```bash
npm run test:helios-health07
```

Runs **3** deterministic integrated trials at `SUNREY_BENCH_SOAK_QUALIFY_MS` (default 45 000 ms).

**Release-style (local):**

```bash
npm run helios:health07:memory-soak
```

Runs **3×** `--soak-ms 120000` with `SUNREY_BENCH_HELIOS_INTEGRATED=1` and writes JSON under `performance/helios/results/health07/`.

**Long profile (local only, not CI):**

```bash
npm run sunrey-bench -- soak --soak-ms 900000
```

## Fixes bundled in HEALTH07

| Area | Change |
| --- | --- |
| Soak claims | Slot-scoped claim ids (128) + post-issuance claim/contribution compaction |
| Soak sampling | 5 s interval (shorter soaks scale interval down) |
| HEALTH06 gate | Chain-only soak passes with phase/trend invariants (no RSS threshold inflation) |
| Integrated soak | Opt-in via `SUNREY_BENCH_HELIOS_INTEGRATED=1`; throttled HELIOS harness ticks |

Audit/evidence durability (sealed fee/MoonRey receipts on eviction) is unchanged.

## Final marker

`HELIOS_MEMORY_SOAK_QUALIFIED` is returned by `evaluateHeliosMemorySoakQualification` only when:

- All soak invariants pass (including `MEMORY_GROWTH_BUDGET` / `MEMORY_STEADY_STATE_TREND`),
- ≥ 4 memory snapshots exist,
- Steady-state trend analysis `ok` is true.

The HEALTH06 subprocess gate uses the **chain-only** canonical command above (no HELIOS env flag).
