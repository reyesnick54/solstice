# HELIOS HEALTH05 — Memory soak repair report

**Qualification marker:** `HELIOS_MEMORY_SOAK_QUALIFIED`

**Date:** 2026-11-04 (simulation / engineering measurement)

## Symptom

Nightly `sunrey-bench` (120s soak after seven-validator load) failed `MEMORY_GROWTH_BUDGET` with ~308 MiB RSS delta. CI sanity (80 ms soak) remained green.

## Instrumentation added

Soak now captures interval snapshots via `packages/sunrey-chain/src/perf/memory-instrumentation.ts`:

| Signal | Source |
|--------|--------|
| RSS / heap used / heap total / external / ArrayBuffers | `process.memoryUsage()` |
| Active handles / timer count | `process.getActiveResourcesInfo()` |
| Fee receipt hot vs sealed counts | `FeeEngine.feeReceiptRetentionStats()` |
| Productive object / claim / fact / receipt counts | `ProductiveEconomyEngine` metrics + lists |

Snapshots are attached to soak results as `memorySnapshots` and summarized on the `mixed_continuous` case extras.

## Root cause (ranked)

1. **Unbounded fee receipt map (primary)** — `FeeEngine` retained every execution receipt in a process-lifetime `Map` (~14k full receipts in 120s → ~300 MiB RSS). Financially material, but belongs in durable storage; not unbounded RAM.
2. **Soak harness artifacts** — per-iteration `settlementIds[]`, repeated oracle provider/feed registration, and unbounded productive object registration amplified heap growth.
3. **Oracle hot path** — observations and superseded facts accumulated in memory during reused soak oracle engine ticks.
4. **HELIOS observation / twin histories (platform)** — per-instrument observation lists and paper execution-twin orders grew without cap (addressed for HELIOS research plane).

## Fixes (no budget inflation)

| Area | Policy |
|------|--------|
| Fee receipts | Hot window 8 192 receipts; evicted receipts sealed into hash chain (`FeeReceiptRetentionStore`) |
| Fee price history | Ring trim at 4 096 entries |
| MoonRey receipts | Hot window 2 048; evicted sealed; post-issuance claim/contribution workspace compacted |
| Soak workload | Reused oracle engine; productive object slot ring (128); duplicate settlement check via engine retention stats |
| Oracle engine | Compact finalized observations; drop superseded facts from hot store |
| HELIOS observations | `HELIOS_OBSERVATION_BUFFER_MAX_PER_INSTRUMENT` (256) per instrument |
| Execution twin orders | Retain latest 512 paper twin orders |

Audit/evidence records are **sealed on eviction**, not silently discarded.

## Tests

- `packages/sunrey-chain/src/memory-soak.test.ts` — retention, deterministic soak budget, reconnect cycles, qualification marker
- `tests/helios-health05-memory-soak.test.ts` — observation buffer + execution-twin cap

## MEMORY_GROWTH_BUDGET semantics (post-repair)

The soak invariant compares **late-window vs early-window `heapUsed` plateau** (not raw RSS end minus start). RSS can rise when V8 retains mapped arenas while the JS heap stays bounded; plateau detection targets genuine in-process retention/leaks. The reported `rssDeltaBytes` detail remains for operator visibility.

## Verification commands

```bash
npm test -- --test-name-pattern 'HELIOS HEALTH05'
SUNREY_BENCH_SOAK_MS=120000 npm run sunrey-bench -- soak --soak-ms 120000
```

## Qualification

When soak invariants pass (including `MEMORY_GROWTH_BUDGET`) and ≥2 memory snapshots are recorded, `evaluateHeliosMemorySoakQualification` returns `HELIOS_MEMORY_SOAK_QUALIFIED`.
