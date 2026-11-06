# Strategy Genome Self-Evolution — Capability Matrix (EVOL15 / EVOL14 requalification)

**Stack marker (when qualification passes):** `HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED`  
**Integration SHA (requalification commit):** `da06734d9c5f2cc4d8de6f92b5daa3bc839697ed`

| ID | Capability | Canonical implementation | Verification |
|----|------------|-------------------------|--------------|
| EVOL01 | Canonical evolution domain (OS05 genome, research-only) | `packages/strategy-lab/src/evolution/` (`types.ts`, `qualification.ts`) | `packages/strategy-lab/src/evolution/evol14-strategy-self-evolution.test.ts` |
| EVOL02 | Mutation / crossover operators | `packages/strategy-lab/src/evolution/operators/evolution-engine.ts` (`mutateStrategyGenome`, `crossoverStrategyGenomes`) | EVOL14 simulation + `packages/strategy-lab/src/helios-evol02-genome-operators.test.ts` |
| EVOL03 | Population archive (append-only ledger) | `packages/strategy-lab/src/evol03/evolution-archive.ts` (`EvolutionArchive`) | `tests/helios-evol03-population-archive.test.ts` + EVOL14 simulation |
| EVOL04 | MAP-Elites / quality-diversity | `packages/strategy-lab/src/evolution/quality-diversity/archive.ts` (`attemptInsertElite`, `createEmptyNicheArchive`) | `tests/helios-evol10-regime-generalization.test.ts` (EVOL04 tests may be co-located) + EVOL14 simulation |
| EVOL05 | CMA-ES parameter evolution | `packages/strategy-lab/src/evol05-cma-es/cma-es.ts` (`runCmaEsGeneration`, `createInitialCmaEsSearchState`) | EVOL14 simulation (4 generations, decoded mean reported) |
| EVOL06 | Population scheduler | `packages/strategy-lab/src/evol06/population-scheduler.ts` (`runPopulationSchedulerTick`) | `tests/helios-evol06-population-scheduler.test.ts` + EVOL14 simulation |
| EVOL07 | Novelty engine | `packages/strategy-lab/src/evol07/novelty-score.ts` (`computeStrategyNoveltyScore`) | `packages/strategy-lab/src/evol07/evol07.test.ts` + EVOL14 simulation |
| EVOL08 | Falsification engine | `packages/platform/src/helios/strategy-evolution/evol08/engine.ts` (`StrategyFalsificationAgent`) | `tests/helios-evol08-falsification-engine.test.ts` + EVOL14 simulation |
| EVOL09 | Multiple-testing firewall + sealed holdout | `packages/platform/src/helios/strategy-evolution/evol09/` (`holdout.ts`, `stats.ts`, `trial-registry.ts`) | `tests/helios-evol09-multiple-testing-firewall.test.ts` + EVOL14 (`DSR_PBO` trial uses outcome `BLOCKED` when overfit is rejected) |
| EVOL10 | Regime generalization | `packages/strategy-lab/src/evol10/regime-generalization.ts` (`evaluateEvol10GenomeRegimeReport`) | `tests/helios-evol10-regime-generalization.test.ts` + EVOL14 simulation |
| EVOL11 | Champion / challenger | `packages/strategy-lab/src/evol11-champion-challenger.ts` (`assessEvol11MaterialChampionReplacement`, `evaluateEvol11ParetoDominance`) | EVOL14 simulation |
| EVOL12 | Strategy Scientist | `packages/strategy-lab/src/evol12/` (`buildEvol12SampleGenomeProposal`, validation) | EVOL14 simulation (`STRATEGY_SCIENTIST` phase) |
| EVOL13 | Meta-evolution / operator credit | `packages/platform/src/helios/strategy-evolution/evol13/credit.ts` (`buildOperatorCreditState`, `createInMemoryOperatorPerformanceLedger`) | `tests/helios-evol13-meta-evolution.test.ts` + EVOL14 simulation |
| EVOL14 | Final orchestrator | `packages/strategy-lab/src/evolution/simulation.ts` (`runStrategyEvolutionSimulation`) + `scripts/helios-evol14-strategy-self-evolution-qualify.ts` | `npm run helios:evol14:qualify` |

## Downstream stacks (required green)

Per HEALTH06 / repository CI, the following must remain green where applicable: **CI** (`bash scripts/ci.sh`), **HELIOS strict typecheck** (`npm run helios:health02:typecheck:qualify`), **architecture** lint (`npm run lint:architecture`), **production safety** (`npm run check-production-safety`), **AAF V2** point-in-time and bias-sentinel qualifies, **EARNINGS** (EARN12), **VALUATION** (VAL12), **Strategy Lab** (`npm run demo:strategy-lab`, EVOL tests), **HEALTH** baseline (`npm run helios:health06:qualify` or `:fast` per environment), **fuzz** / **formal** extended suites, **nightly bench** (`npm run sunrey-bench` / repo bench scripts as defined in CI).

## Live execution

- `LIVE_TRADING_ENABLED=false`, `production_authorized=false` (authority map / config).
- No evolved genome may self-authorize live execution; promotion remains **research-only** (`liveEligible: false` on Strategy Lab promotion paths).

## Trial ledger semantics (EVOL14)

- **SUCCESS**: phase completed as intended (green path).
- **FAILED**: phase completed but did not meet promotion or comparison criteria (e.g. research promotion not justified).
- **BLOCKED**: firewall or gate stopped progression (e.g. `DSR_PBO` when the flashy candidate is rejected as overfit). Blocked trials are **not** counted as successes; see qualification JSON `trialBlockedCount`.
