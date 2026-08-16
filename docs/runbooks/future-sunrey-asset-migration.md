# Future SunRey asset migration

This runbook describes the **schema only**. No production migration
is performed.

## Boundary

- Source: `CURRENT_APPLICATION_AUTHORITY` (`packages/sunrey-coin` +
  canonical Ledger)
- Destination: `NATIVE_BLOCKCHAIN_AUTHORITY` (SunRey Blockchain
  native asset state)
- Application balances are not a premine.

## Manifest fields

- `source_system` / `destination_system`
- `source_snapshot_id`
- `asset` (`SUNREY_COIN` or `MOONREY_COIN`)
- account / actor mappings
- `source_supply_scaled` / `destination_supply_scaled`
- Merkle / state commitment
- `migration_height`
- signatures
- audit evidence
- `production_migration_performed` (must be `false` in this chunk)
- `ticker_status` (`NOT_ASSIGNED`)

## Fixture

Rust: `AssetMigrationManifest::development_fixture()`
TypeScript: `developmentMigrationFixture()`

A later ADR and Kernel-gated action are required before any
production migration. Until then the Ledger remains authoritative
for application SunRey Coin.
