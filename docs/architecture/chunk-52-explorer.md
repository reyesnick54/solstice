# Chunk 52 — SunRey block explorer, economic explorer, and rebuildable chain indexer

Implemented on latest `main` after Chunks 40–50. The explorer is a
transparent public projection of finalized SunRey Blockchain state and
derived economic views.

Canonical owner: `packages/sunrey-explorer`.

- Indexer, privacy policy, query API, CLI: `packages/sunrey-explorer`
- Durable projection schema: `db/explorer`
- Web interface: `apps/explorer`

Do not create `packages/block-explorer`, `packages/chain-indexer`,
`packages/explorer`, or a second indexer.

## Core principle

The explorer database is a projection.

Canonical authority remains:

- SunRey Blockchain finalized state
- existing canonical systems for their own domains (Ledger, Kernel,
  Evidence Vault, custody)

Explorer data is fully rebuildable. Never alter blockchain state to
repair an explorer index.

## What this chunk implements

- Finalized block, transaction, account, and native-asset indexes
- Validator, consensus-certificate, governance, and accountability views
- Oracle, productive-economy, MoonRey attribution, machine-economy,
  interoperability, and exchange-settlement views
- Bounded sanitized search
- Read-only Explorer API with cursor pagination and lag fields
- Functional web UI with a DEVELOPMENT network banner and live events
- `sunrey-explorer` CLI: `run`, `index`, `rebuild`, `verify`, `status`
- Deterministic rebuild and indexer catch-up tests

## What this chunk does not implement

- An authoritative ledger or a second blockchain state store
- Production mainnet explorer branding
- Personal Data Vault, Clean Room, KYC, or private wallet-key display
- Live RPC to an external network

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
Public tickers remain `NOT_ASSIGNED`. Development/testnet quantities
are never presented as market capitalization.
