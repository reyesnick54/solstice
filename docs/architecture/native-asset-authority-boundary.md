# Native asset authority boundary

Companion to ADR-0026, ADR-0031, and the SunRey chain authority
matrix.

## Two authorities

| Label | Store | What it is |
| --- | --- | --- |
| `CURRENT_APPLICATION_AUTHORITY` | Canonical Ledger via `packages/sunrey-coin` | Simulation SunRey Coin journals. Kernel-gated issue / transfer / burn. |
| `NATIVE_BLOCKCHAIN_AUTHORITY` | Deterministic SunRey Blockchain state in `packages/sunrey-chain` | Development-network native units for `SUNREY_COIN` and `MOONREY_COIN`. |

These are not the same supply. Development native units start at
zero. Application balances are not a premine and are not imported.

## Conflict rule

Fiat or current application SunRey Coin journals versus chain
native units: **Ledger wins** until a later Kernel-gated migration
ADR is accepted and executed. Silent dual-authority is forbidden.

## Migration

A versioned `AssetMigrationManifest` can record source snapshot,
account mappings, supply figures, Merkle/state commitment,
migration height, signatures, and audit evidence. This chunk
ships the schema and a deterministic fixture only.
`production_migration_performed` is always `false`.

## MoonRey

MoonRey Coin is a protocol-native asset on the development chain.
It is not an application package, not a share of SunRey Coin, and
not a ticker alias. Production economic issuance is later.
