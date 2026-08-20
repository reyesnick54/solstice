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
Chunk 141 defines the current product identity and the rules for
touching historical Solstice identifiers. It does **not** perform the
safe rewrite. That is Chunk 142.

Owner: `packages/config`.
Canonical module: `packages/config/src/product-identity.ts`.
This is not `packages/domain/src/brand.ts`, which is a TypeScript
nominal-brand utility.

## Canonical current names

| Role | Name |
| --- | --- |
| Master brand | SunRey |
| Application / financial platform | SunRey |
| Blockchain | SunRey Blockchain |
| Technical chain name | SunRey Chain |
| Native human economic asset (display) | SunRey Coin |
| Native productive economic asset (display) | MoonRey Coin |
| Digital-asset exchange | SunRey Exchange |
| AI | SunRey AI Agent |
| Native asset tickers | `NOT_ASSIGNED` |

Do not invent tickers.

## Asset IDs versus display names

Protocol IDs remain:

- `SUNREY_COIN`
- `MOONREY_COIN`

Display names are UI labels only. Business logic must keep using the
protocol IDs. The audit must not rewrite those IDs.

## Legacy identity

`SOLSTICE`, `Solstice`, and `solstice` are `LEGACY_PRODUCT_IDENTITY`.
They are not current branding.

## Classification

Every inventoried occurrence receives one class:

- `PUBLIC_PRODUCT_NAME`
- `PUBLIC_API_METADATA`
- `PUBLIC_CLI_OUTPUT`
- `PUBLIC_SDK_METADATA`
- `PUBLIC_EXPLORER_METADATA`
- `PACKAGE_METADATA`
- `ENVIRONMENT_VARIABLE`
- `INTERNAL_RUNTIME_SYMBOL`
- `INTERNAL_PACKAGE_PATH`
- `DATABASE_IDENTIFIER`
- `MIGRATION_IDENTIFIER`
- `PROTOCOL_IDENTIFIER`
- `EVENT_TYPE_IDENTIFIER`
- `HASH_DOMAIN`
- `FIXTURE`
- `HISTORICAL_DOCUMENTATION`
- `REPOSITORY_NAME`
- `GIT_REFERENCE`
- `NAMING_CONSTITUTION`

## Migration policy

| Policy | Typical use |
| --- | --- |
| `MUST_MIGRATE` | Current public app, CLI, SDK, Explorer, and README copy |
| `MIGRATE_WITH_ALIAS` | `SOLSTICE_*` environment names |
| `PRESERVE_IMMUTABLE` | Migration filenames, persisted events, hash domains, protocol IDs |
| `HISTORICAL_ONLY` | Repository name, labeled historical documents, fixtures |
| `MANUAL_REVIEW` | Internal symbols and package names that are not public copy |

Examples:

- Current public app display name → `MUST_MIGRATE`
- Current CLI banner → `MUST_MIGRATE`
- `SOLSTICE_*` environment configuration → `MIGRATE_WITH_ALIAS`
- Old database migration filename → `PRESERVE_IMMUTABLE`
- Old persisted event type → `PRESERVE_IMMUTABLE`
- Old hash domain → `PRESERVE_IMMUTABLE` unless a deliberate protocol upgrade
- GitHub repository name `solstice` → `REPOSITORY_NAME` / `HISTORICAL_ONLY`

## Historical immutability

Never change an identifier if doing so would alter:

- existing commitment hashes
- historical event replay
- persisted event discriminators
- database migration ordering
- chain protocol replay
- signature domains
- existing economic fingerprints
- genesis hashes
- transaction IDs

Those require explicit versioned migrations, not branding replacement.

## Environment variables

All `SOLSTICE_*` names are inventoried in
`packages/config/src/naming-env-inventory.ts`. Each has a canonical
`SUNREY_*` replacement, `legacyAliasRequired=true`, and
`safeRemovalDate=NOT_SELECTED`. Chunk 141 does not remove them.

## TypeScript symbols

Public exports such as `SolsticeIdentityId` may later receive a
deprecated SunRey alias. Private historical symbols are not renamed
solely for aesthetics.

## Packages and directories

Do not rename large package directories for this chunk.

Canonical SunRey directories stay:

- `packages/sunrey-chain`
- `packages/sunrey-exchange`
- `packages/sunrey-agent`
- `packages/sunrey-sdk`

Generic packages such as `packages/kernel`, `packages/domain`, and
`packages/money` do not need a SunRey prefix.

The GitHub repository directory `solstice` can remain until
repository administration changes it separately.

## Documentation

Current architecture documentation should say SunRey. Historical
documents that explain prior Solstice architecture may remain when
they are clearly labeled historical. Do not rewrite historical
evidence as though the old name never existed.

## Public-surface rule

`NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN=true`.

New public runtime surfaces must use SunRey. Public surfaces include
app metadata, API metadata, CLI output, SDK metadata, Explorer
metadata, the current README / product description, and generated
reports intended as current product documentation.

Approved historical identifiers do not fail CI. A **new**
non-allowlisted public-surface Solstice name does.

Do not allowlist an active public-facing Solstice name just to make
CI green.

## Inventory

Machine-readable: [`sunrey-naming-inventory.json`](./sunrey-naming-inventory.json).
Human-readable: [`sunrey-naming-inventory.md`](./sunrey-naming-inventory.md).
Frozen public-surface debt: [`sunrey-naming-public-debt.json`](./sunrey-naming-public-debt.json).

Counts are generated from the repository. Do not invent them.

```
npm run naming:audit
npm run demo:sunrey-product-identity
```
