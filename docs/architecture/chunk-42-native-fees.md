# Chunk 42 — SunRey native fees, execution metering, and resource economics

Implemented on latest `main` after Chunk 41. Dual native assets
(`SUNREY_COIN`, `MOONREY_COIN`) live in
`packages/sunrey-chain/rust/crates/native-assets`. FeeIntent attaches
beside that payload; this chunk does not replace it. This chunk does
not reimplement Money, the Compliance Kernel, Execution Authority, the
Evidence Vault, or the canonical fiat ledger.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/fees/`
- Local-node engine: `packages/sunrey-chain/rust/crates/fees`
- CLI: `sunrey-node fees …`

Do not create `packages/fees`, `packages/sunrey-fees`, or
`packages/gas`.

## Core principle

Every state-changing SunRey transaction has deterministic, bounded
resource consumption and auditable native-asset fee handling.
Validators independently recompute usage. Running a different binary
cannot alter fees. Fee parameters change only when a Chunk 40
`UpgradePlan` (`FEE_PARAMETER_CHANGE` or `PARAMETER_CHANGE`) activates
at a defined height.

This is not Ethereum gas. Resource classes are explicit. There is no
floating-point price, no automatic SunRey/MoonRey conversion, and no
fiat ledger debit.

## Resource units

Unsigned integers only:

- `COMPUTE_UNITS`
- `STATE_READ_UNITS`
- `STATE_WRITE_UNITS`
- `TRANSACTION_BYTE_UNITS`
- `SIGNATURE_VERIFY_UNITS`
- `CRYPTOGRAPHIC_PROOF_UNITS`

Oracle and productive-capacity modules may add versioned classes later.

## Execution budget

Every fee-paying transaction declares:

- `max_execution_units`
- `max_fee`
- `fee_asset`
- `fee_payer` (authenticated)

Sponsor / fee delegation is reserved. A wealthy actor cannot request
unbounded execution: `max_execution_units` is capped at
`MAX_TX_EXECUTION_UNITS` (100000).

## Failed-transaction fee semantics

| Stage | Chain state | Fee |
| Stateless validation failure | No mutation | None |
| Mempool validation failure | No mutation | None |
| Network spam that never enters a block | No mutation | None |
| Entered a finalized block, controlled application failure | Fee accounting only; application writes roll back | Charge metered usage, at most `max_fee` |
| `OUT_OF_EXECUTION_UNITS` | Fee accounting only; application writes roll back | Charge consumed units, at most `max_fee` |

State transition of application objects remains atomic.

## Development faucet

`DEVELOPMENT_FAUCET` is an explicit exemption isolated to development
networks. Faucet transactions do not recursively require unavailable
fees. `DEVELOPMENT_PROTOCOL` covers pre-fee SYSTEM / EVIDENCE fixtures
on the local development node only.

## What this chunk does not implement

- Production fee markets or a public network
- Automatic SunRey/MoonRey exchange-rate conversion
- Public staking-yield, fiat yield, or off-chain customer credit
- Counsel-confirmed tokenomics (`RESEARCH_REQUIRED`)
- MoonRey as an enabled fee asset (policy-ready, governance-gated)

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
