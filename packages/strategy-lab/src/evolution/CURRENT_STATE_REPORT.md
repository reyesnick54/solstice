# HELIOS EVOL01 — Strategy evolution domain (current state)

**Recorded `origin/main` SHA:** `f1c1c5cefa846b8818c20aae068a73d8dbd60280` (at audit time).

## Summary

| Area | Status |
|------|--------|
| Canonical Strategy Genome (OS05, Native06, EARN11, etc.) | **Present** — `packages/strategy-lab/src/os05/`, `native06/`, `earn11/` |
| Strategy Lab evaluation & chronology | **Present** — `packages/strategy-lab/src/evaluation/` |
| Promotion / demotion / forward shadow (human authority, no self-promotion) | **Present** — `promotion*.ts`, `demotion.ts`, `forward-shadow.ts`, `promotion-authority.ts` |
| HELIOS platform bridges (AAF v2, earnings, valuation) | **Present** — see below |
| **Dedicated evolution program domain** (`EvolutionProgram`, lifecycles, evidence manifest) | **Added** — `packages/strategy-lab/src/evolution/` (this change) |
| Evolution execution engine (generations, selection, persistence) | **Missing** — types only; no scheduler, store, or service |
| Wiring evolution → existing evaluation/promotion flows | **Missing** — explicit adapters not implemented |

## Audited paths (what exists today)

### `packages/strategy-lab/src/os05/`

- Declarative **Strategy Genome** schema: node kinds, lineage with `genomeHash`, validation and qualification (`evaluateOs05StrategyGenomeQualification`).
- **No second schema** introduced by EVOL01; evolution candidates reference `StrategyGenome` from here.

### `packages/strategy-lab/src/native06/`

- **Bytex → Native06** genome translation, separate genome schema for vendor documents; still declarative, catalog-backed.
- Complements OS05; evolution may target OS05 genomes first (canonical for HELIOS per task).

### `packages/strategy-lab/src/promotion*` and related

- `promotion.ts` — human-only promotion reviews; `paperEligibility` lists gates AI cannot waive.
- `promotion-authority.ts`, `promotion-state.ts`, `promotion-gates.ts`, `promotion-service.ts`, `promotion-store.ts`, `promotion-evidence.ts`, `promotion-capsule.ts` — **single** promotion authority path; evolution does not add another.

### `packages/strategy-lab/src/demotion.ts`

- Demotion triggers and records; preserves **prior evidence** (`priorEvidencePreserved: true`).

### `packages/strategy-lab/src/forward-shadow.ts`

- Forward shadow runs/decisions with **no broker submission**, **no financial effect** flags.

### `packages/strategy-lab/src/overfitting.ts`

- Heuristic overfitting warnings for research (parameters, train/test gap, many trials).

### `packages/strategy-lab/src/evaluation/`

- Chronological evaluation, dataset manifests, qualification outcomes, sealed `StrategyEvaluationRecord` — primary place to attach **evolved** candidate metrics.

### `packages/platform/src/helios/adaptive-alpha-v2/`

- AAF v2 pipeline, gates, qualification; `strategy-lab-bridge.ts` exposes portable refs for Strategy Lab promotion gates (**not** duplicated by evolution).

### `packages/platform/src/helios/earnings-intelligence/`

- Large earnings domain (event graph, transcripts, earn11 strategy genome bridge, anti-overfitting helpers). Feeds research; **no** evolution orchestrator here.

### `packages/platform/src/helios/valuation-intelligence/`

- Valuation engines, strategy-genome feature bridges, qualification. Same boundary: intelligence feeds evaluation; **no** evolution runner.

## New: `packages/strategy-lab/src/evolution/`

Defines **EvolutionProgram**, **EvolutionRun**, **EvolutionGeneration**, **GenomeCandidate**, **GenomePopulation**, **GenomeLineageEdge**, **EvolutionObjective**, **EvolutionBudget**, **EvolutionPolicy**, **EvolutionEvidenceManifest**, plus **EVOLUTION_CANDIDATE_LIFECYCLE** states:

`PROPOSED` → `VALIDATED` → `EVALUATING` → `CHALLENGER` / `CHAMPION` / `NICHE_ELITE` → `DEGRADED` / `DEMOTED` / `RETIRED` / `REJECTED`.

**Qualification:** `HELIOS_EVOL01_EVOLUTION_DOMAIN_QUALIFIED` (exported as `HELIOS_EVOL01_EVOLUTION_DOMAIN_QUALIFIED` in `types.ts`).

## Still missing (recommended follow-ups)

1. **Store / service** — persist programs, runs, generations, candidates, lineage edges, and append-only evaluation refs.
2. **Operators** — mutation/crossover as **declarative** genome edits only (parameter/graph edits), validated through existing `validateStrategyGenome` / compilers.
3. **Integration** — call `evaluation/` to produce `StrategyEvaluationId[]` per candidate; link `EvolutionEvidenceManifest` to sealed records.
4. **Governance** — map evolution policy to existing `promotion-authority` and AAF refs so evolution cannot assert promotion.
5. **Tests** — fixture programs, lifecycle transition guards, and architecture guard that evolution never emits authority or live promotion.

## Critical rule (enforced by design of this module)

Evolution may create and evaluate **research** strategies as declarative genomes. It must not: issue Execution Authority, modify risk limits, waive AAF or compliance gates, promote itself to live trading, or erase failed trials.
