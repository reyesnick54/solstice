# Chunk 68 — SunRey production oracle provider onboarding

Implemented on latest `main` after Chunk 65. Canonical owner remains
`packages/sunrey-chain`. This chunk extends the Chunk 43 oracle
engine. It does not create a second oracle consensus system.

- TypeScript data plane: `packages/sunrey-chain/src/oracle/production/`
- Local-node checks: `packages/sunrey-chain/rust/crates/oracle`
- CLI: `sunrey-oracle`
- Readiness: Chunk 65 `OracleReadinessSlot`

Do not create `packages/oracle`, `packages/sunrey-oracle`,
`packages/oracle-network`, `packages/production-oracles`,
`packages/oracle-onboarding`, or `packages/oracle-collector`.

## Consensus principle

Consensus execution does not call HTTP APIs, websites, AI models,
external databases, or IoT endpoints. The off-chain `OracleCollector`
authenticates, validates, normalizes, signs, and submits
`OracleObservation` values to the existing engine. Validators
deterministically verify those observations.

A random external API response is never consensus truth.

## What this chunk implements

- `OracleProviderOnboardingRecord` with DRAFT through REVOKED
- Versioned `EconomicDataSource` registry
- Source provenance on every collected observation
- Provider-neutral `OracleSourceAdapter` authentication classes
- Deterministic local provider simulator for CI
- SecretReference-only credentials and collector isolation
- Software, KMS, and HSM signing interfaces on `ORACLE_SIGNING`
- Chunk 60 hybrid oracle signatures where configured
- Exact feed schema validation and versioned integer normalization
- Source-independence and concentration analysis
- Versioned quality scoring and production quorum policy
- Fail-closed fact creation when quorum is absent
- Provider suspension, key rotation, and incident controls
- `ProductionContributionEligibilityPolicy` for MoonRey
- Safe Explorer public feed metadata
- Seven-validator development E2E

## What this chunk does not claim

- A live market-data or IoT network
- Confirmed commercial agreements that were not supplied
- Production HSM post-quantum algorithms
- Automatic MoonRey minting from oracle facts
- Sybil resistance

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
