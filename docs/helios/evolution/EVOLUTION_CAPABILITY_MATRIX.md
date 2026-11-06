# Strategy Genome Self-Evolution — Capability Matrix (EVOL14)

**Stack marker:** `HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED`

| ID | Capability | Implementation | Verification |
|----|------------|----------------|--------------|
| EVOL01 | Canonical evolution domain | `packages/strategy-lab/src/evolution/` (EVOL14 module) | `packages/strategy-lab/src/evolution/evol14-strategy-self-evolution.test.ts` |
| EVOL02 | Mutation / crossover | `cloneGenome`, `crossoverGenomes` in `simulation.ts` | EVOL14 simulation + tests |
| EVOL03 | Population archive | Population array + valid elite filter | EVOL14 simulation |
| EVOL04 | Quality diversity (MAP-Elites) | `buildMapElites` | EVOL14 simulation |
| EVOL05 | CMA-ES parameter evolution | `runCmaEsToy` (toy mean update) | EVOL14 simulation |
| EVOL06 | Population scheduling | `POPULATION_SCHEDULING` trial | EVOL14 simulation |
| EVOL07 | Novelty | `assessNovelty` | EVOL14 simulation |
| EVOL08 | Falsification | `runFalsification` | EVOL14 simulation |
| EVOL09 | Multiple-testing firewall | `packages/platform/src/helios/strategy-evolution/evol09/` (DSR, PSR, PBO, FDR, family-wise budget, sealed holdout) | `tests/helios-evol09-multiple-testing-firewall.test.ts` + EVOL14 simulation |
| EVOL10 | Regime generalization | `evaluateStrategyRegimeGating` + overfit genome gate | EVOL14 simulation |
| EVOL11 | Champion / challenger | `ChampionChallengerComparison` | EVOL14 simulation |
| EVOL12 | Strategy Scientist | `StrategyScientistObservation` | EVOL14 simulation |
| EVOL13 | Operator intelligence | `operatorIntelligenceRef` + mutation tags | EVOL14 simulation |

## Downstream stacks (required green)

Per HEALTH06 / EVOL14 qualification runner, the following must remain green in CI: **CI**, **HELIOS strict typecheck** (`tsconfig.helios-strict.json`), **architecture** lint, **production safety**, **AAF V2**, **EARNINGS** (EARN01–EARN12), **VALUATION** (VAL12), **Strategy Lab** (includes EVOL14 test), **Execution Twin**, **HEALTH** baseline, **fuzz**, **formal**, **nightly bench**.

## Live execution

- `LIVE_TRADING_ENABLED=false`, `production_authorized=false` (authority map).
- No evolved genome may self-authorize live execution; research promotion only.
