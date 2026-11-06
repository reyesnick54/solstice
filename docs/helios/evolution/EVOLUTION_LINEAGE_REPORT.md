# EVOL14 — Strategy Genome Lineage Report

Lineage is **declarative** (OS05 `StrategyGenomeLineage`): parent genome IDs, mutation reason, catalog/manifest versions, and `genomeHash` from `attachGenomeHash`.

## Seed line

| Genome | Role |
|--------|------|
| `sgnm_helios_os05_mean_reversion_example` (OS05 fixture) | Primary seed |
| Seeds B/C | Parameter nudges via `withParam` |

## Derived lineages (simulation)

| Genome ID | Parents | Operator tag |
|-----------|---------|----------------|
| `sgnm_evol14_mut_A` | OS05 example | MUTATION |
| `sgnm_evol14_crossover` | mut_A × seed B | CROSSOVER |
| `sgnm_evol14_overfit_flashy` | OS05 example | PARAMETER_SEARCH + REGIME_AND_THRESHOLD |
| `sgnm_evol14_moderate_robust` | OS05 example | CROSSOVER (conservative params) |

## Evidence sealing

Each phase produces `EvolutionSealedEvidenceEntry` records (`contentHash` over phase + trial + material). The final `EVIDENCE_SEAL` aggregates the full trial ledger and git SHA.

## No live authority

Lineage and hashes **do not** confer Execution Authority or live trading. Promotion remains **research-only** (`liveEligible: false` on Strategy Lab promotion paths).
