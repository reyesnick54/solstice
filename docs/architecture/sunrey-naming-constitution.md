# SunRey naming constitution

This is the classification constitution for product naming. Brand
display is not protocol identity.

## Current master brand

The current product brand is **SunRey**. `Solstice` is a historical
and compatibility name. The GitHub repository path remains
`reyesnick54/solstice`.

## Classification

Every inventoried identifier is one of:

| Class | Meaning | Chunk 142 action |
| --- | --- | --- |
| `MUST_MIGRATE` | Current public product branding or active runtime name | Replace with SunRey / `SUNREY_*` |
| `MIGRATE_WITH_ALIAS` | Active public symbol or env that callers may still use | Canonical SunRey name plus one deprecated alias |
| `PRESERVE_IMMUTABLE` | Protocol, catalog, hash, event, or repository identity | Leave unchanged |
| `HISTORICAL_ONLY` | Past reports, ADRs, or completed chunk titles | Leave unchanged |
| `MANUAL_REVIEW` | Stored credential, export-format, or catalog copy | Leave unchanged unless a versioned migration exists |

Proofs and classifications may only get stricter.

## Canonical environment resolution

1. `SUNREY_*` if provided
2. legacy `SOLSTICE_*` if canonical is absent
3. documented default

If both are supplied with different values, fail with
`LEGACY_ENV_CONFLICT`. Diagnostics expose `legacyAliasUsed`,
`canonicalName`, and `legacyName` only. Secret values are never logged.

There is one env-name authority: `packages/config`. Persistence and
scripts resolve through that authority.

## What must not change

- `SUNREY_COIN`, `MOONREY_COIN`
- `networkId`, `chainId`, address HRP, protocol version
- existing hash / signature / fingerprint domains
- persisted historical event `schemaRef` values
- already-applied database migrations and database names
- GitHub repository path
- `ENVIRONMENT` and every `LIVE_*` flag

New event schema refs use the `sunrey.` prefix. Historical
`solstice.*` refs remain stored and replay unchanged.

## Inventory

The generated inventory is [`sunrey-naming-inventory.json`](./sunrey-naming-inventory.json)
and [`sunrey-naming-inventory.md`](./sunrey-naming-inventory.md).
The runtime migration is [`sunrey-naming-migration.md`](./sunrey-naming-migration.md).
