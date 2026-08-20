# CHUNK-154 — Production operational persistence and crash recovery

Capability `sunrey-operational-persistence-recovery` is `IMPLEMENTED` on
the existing owner `packages/persistence`. This chunk moves critical
application operational state from process memory toward restart, crash,
replay, and recovery — without creating a second ledger.

## Canonical authorities (unchanged)

- `Ledger.postJournal` remains fiat/customer banking journal authority.
- SunRey Chain / `AssetSupplyBook` remains native-asset supply authority.
- Evidence Vault remains evidence authority.
- Domain owners remain business-state authority.
- PostgreSQL remains a durable application-state adapter.

PostgreSQL cannot mint SunRey Coin, mint MoonRey Coin, mutate
`AssetSupplyBook` directly, issue Execution Authority, or replace ledger
postings. Provider operational state cannot replace Kernel decisions.

## What this chunk adds

1. Repository JSON integrity is a CI preflight (`scripts/check-json-integrity.mjs`)
   after Node setup and before `npm ci`.
2. Durable fixture file stores (`DurableCustodyStore`,
   `DurableExchangeStore`, plus payment and provider fixtures) use a
   versioned snapshot envelope (`schemaVersion`, `storeKind`, `createdAt`,
   `sequence`, `contentHash`, `payload`).
3. `FILE_NOT_FOUND` initializes an empty fixture. `CORRUPT_JSON`,
   `SCHEMA_INVALID`, `CHECKSUM_MISMATCH`, `PARTIAL_WRITE`,
   `UNKNOWN_SCHEMA_VERSION`, and `UNSUPPORTED_SCHEMA_VERSION` fail closed.
4. Production-candidate PostgreSQL tables in the existing `customer` and
   `security` databases persist payment, custody, exchange, and provider
   control-plane metadata with explicit `SUNREY_COIN` / `MOONREY_COIN`
   identity and revision/CAS guards.
5. A recovery catalog at `packages/persistence/src/production/recovery`
   coordinates rehydration order, unresolved-operation discovery, and
   readiness reporting. It is not a workflow engine.

## Data minimization

Operational rows store references and commitments. They must not store
API keys, OAuth tokens, client secrets, private keys, Travel Rule
plaintext, raw KYC documents, biometrics, or raw oracle vendor payloads.

## Recovery readiness

`READY`, `DEGRADED`, `RECONCILIATION_REQUIRED`, `CORRUPT_STATE`,
`SCHEMA_MISMATCH`, `BACKUP_REQUIRED`, and `MANUAL_REVIEW_REQUIRED`.
Critical corruption fails closed. Startup reconciliation identifies
unresolved `SUBMISSION_UNKNOWN`, pending settlement, expired outbox
leases, interrupted inbox work, and pending provider revalidation. It
does not automatically repeat consequential provider submissions.

## Demo

`npm run demo:sunrey-operational-persistence-recovery`
