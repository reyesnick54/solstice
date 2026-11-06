# EVOL14 / EVOL15 — Strategy Genome Lineage Report

**Git SHA:** `746456720a0fc6ab0ad8344dd07b5d160e7fb6ed`

Lineage is **declarative** (OS05 `StrategyGenomeLineage`): parent genome IDs, mutation reason, catalog/manifest versions, and `genomeHash` from `attachGenomeHash`.

## Seed line

| Genome | Role |
|--------|------|
| `sgnm_helios_os05_mean_reversion_example` (OS05 fixture) | Primary seed A |
| Derived seed B, C | `mutateStrategyGenome` (EVOL02) with distinct random seeds |

## Derived lineages (simulation)

| Genome ID | Parents | Operator |
|-----------|---------|----------|
| `sgnm_evol14_mut_A` | OS05 example | EVOL02 `PARAMETER_MUTATION` |
| `sgnm_evol14_crossover` | mut_A × seed B | EVOL02 `crossoverStrategyGenomes` (`PARAMETER_BLEND`) |
| `sgnm_evol14_moderate_robust` | mut_A × seed B | EVOL02 `PARAMETER_BLEND` (conservative blend) |
| `sgnm_evol14_overfit_flashy` | OS05 example | Custom fixture (`PARAMETER_SEARCH` + `REGIME_AND_THRESHOLD`) |

## EVOL03 archive

Each population genome registers in `EvolutionArchive` with **`innerTrainVal`** metrics (partitioned evaluation slice); the flashy genome’s trial includes a **non-null `failure`** record (poor inner economics), so rejected/weak evaluations remain on the ledger.

## Evidence sealing

Each phase produces `EvolutionSealedEvidenceEntry` records (`contentHash` over phase + trial + material). The final `EVIDENCE_SEAL` aggregates the full trial ledger and git SHA.

## No live authority

Lineage and hashes **do not** confer Execution Authority or live trading. Promotion remains **research-only** (`liveEligible: false` on Strategy Lab promotion paths).
