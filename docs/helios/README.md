# HELIOS — Phase 1 architecture audit

HELIOS is an integrated intelligence and orchestration capability built through canonical SunRey owners. It does not introduce a second ledger, Kernel, Execution Authority, Exchange, or agent financial authority.

## H01 deliverables (baseline)

| Document | Purpose |
|----------|---------|
| [H01 Runtime Truth Map](./H01_RUNTIME_TRUTH_MAP.md) | Human-readable repository and runtime composition audit |
| [helios-runtime-truth-map.json](./helios-runtime-truth-map.json) | Machine-readable subsystem classification and evidence |
| [helios-authority-matrix.json](./helios-authority-matrix.json) | HELIOS-relevant canonical authority matrix |
| [H01_GAP_REGISTER.md](./H01_GAP_REGISTER.md) | Phase 1 gap register with H02/H03 inputs |

## Baseline recorded

- **Repository:** `reyesnick54/solstice`
- **Audit branch:** `cursor/helios-h01-truth-map-703d`
- **Base SHA:** `3c13beb3df000c25b8e81b953058387d9b04774d` (`origin/main`, local matches)
- **Workspace version:** `sunrey@0.1.0`
- **Migration heads:** customer `V046`, ledger `V010`, evidence `V001`, security `V002`

## Scope boundary

H01 is audit-only. H02 covers quantitative/statistical correctness. H03 covers agent proposal and execution-state correctness. Do not pull H04+ work into Phase 1.
