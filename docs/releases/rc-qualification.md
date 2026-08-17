# RC qualification

`RCQualificationMatrix` records one cell per category. Every cell
references the exact RC source commit. No qualification result may
cite a different commit.

## Categories

BUILD, PROTOCOL, CONSENSUS, CRYPTO, WALLET, NATIVE_ASSETS, MOONREY,
EXCHANGE, CUSTODY, ORACLE, MACHINE, INTEROP, SDK, EXPLORER, SECURITY,
FORMAL, PERFORMANCE, OPERATIONS, DR, SUPPLY_CHAIN.

## States

- `PASS`
- `FAIL`
- `NOT_APPLICABLE`
- `PENDING_EXTENDED_TEST`

## Suites attached at the RC commit

| Category | Suite |
| --- | --- |
| BUILD | Artifact freeze + supply-chain inventory |
| PROTOCOL | Frozen schema hashes |
| CONSENSUS | Seven-validator genesis, peers, BFT, state-root agreement |
| CRYPTO / PQC | Chunk 60 known-answer, hybrid, downgrade, wallet, validator, oracle |
| WALLET | Classical, hybrid, PQ-capable, M-of-N, watch-only |
| FORMAL | Chunk 61 smoke when present; otherwise property/invariant smoke |
| FUZZ / SECURITY | Chunk 56 smoke + corpus; Chunk 57 critical invariants |
| PERFORMANCE | Chunk 58 sanity vs stored baseline; regressions are reported |
| OPERATIONS / DR | Chunk 55 multi-domain, upgrade rehearsal, snapshot restore, persistence reconcile, Explorer rebuild |
| SDK / EXPLORER | TypeScript/Rust vectors; projection rebuild query equivalence |
| SUPPLY_CHAIN | Chunk 59 audit, SBOM, provenance |

Performance regressions are reported. No arbitrary performance number
alone determines correctness.

## RC status

- `BUILDING`
- `QUALIFICATION_IN_PROGRESS` — a required cell failed
- `QUALIFIED_FOR_TESTNET_RC`
- `QUALIFIED_WITH_PENDING_EXTENDED_TEST`
- `SUPERSEDED`

No status implies mainnet readiness.
