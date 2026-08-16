# Chunk 43 — SunRey sovereign oracle network

Implemented on latest `main` after Chunk 40. Chunk 42 (general
blockchain resource metering) is not a standalone capability on
`main`. Oracle submissions consume the integer resource-meter port
in this owner: bounded payloads, integer resource units, fail-closed
oversized observations.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/oracle/`
- Local-node module: `packages/sunrey-chain/rust/crates/oracle`
- CLI: `sunrey-node oracle …`
- RPC: `/oracle/providers`, `/oracle/feeds`, `/oracle/observation/:id`,
  `/oracle/fact/:id`, `/oracle/facts`, `/oracle/disputes`,
  `/oracle/quality`

Do not create `packages/oracle`, `packages/sunrey-oracle`, or
`packages/oracle-network`.

## Consensus principle

Consensus execution does not call HTTP APIs, websites, AI models,
external databases, cloud services, or IoT endpoints. Off-chain
`OracleAdapter` implementations collect information and submit signed
`OracleObservation` values. Validators deterministically verify and
finalize those observations.

A random external API response is never consensus truth.

## Provider model

`OracleRegistry` stores `OracleProviderRecord` values: oracle id,
controller actor, optional legal-entity reference, classification,
public key, CryptoSuite, authorized feed types, jurisdictions,
geographic scope, methodology reference, status, activation height,
optional expiration, reputation metadata, and schema version.

Private keys are never stored on-chain.

Classifications (`INSTITUTIONAL_DATA_PROVIDER`, `REGULATED_PROVIDER`,
`ENTERPRISE_SENSOR_NETWORK`, `DEVICE_ORACLE`, `ATTESTATION_PROVIDER`,
`AUDITOR`, `PUBLIC_DATA_PROVIDER`, `COMPOSITE_ORACLE`) are not legal
approval.

## Feeds and units

`OracleFeedDefinition` binds a fact type to a unit, subject schema,
aggregation policy, minimum sources, maximum age, outlier policy,
confidence floor, activation height, and status.

`UnitRegistry` uses fixed-point integer quantities with an explicit
scale. Incompatible units are refused. There is no floating point.

## Aggregation and quorum

Deterministic integer methods: `MEDIAN`, `WEIGHTED_MEDIAN`,
`QUORUM_MATCH`, `TRIMMED_MEDIAN`, `CATEGORICAL_QUORUM`.

Economically significant feeds require independent sources, optional
required source classes, a minimum quorum, and a maximum observation
spread. A feed may permit one authoritative provider only when
governance configures that model explicitly.

Material disagreement marks the window `CONFLICTED`. Economic modules
fail closed. The engine does not pick a convenient value.

## Quality and staleness

Statuses: `PENDING`, `VERIFIED`, `CONFLICTED`, `STALE`,
`REVOKED_SOURCE`, `SUPERSEDED`.

Facts expire by feed policy. A stale fact cannot be used for new
MoonRey issuance eligibility. Historical blocks retain the fact as
historically valid at its original time.

Provider suspension or revocation affects future observations only.
Finalized history is not rewritten.

## Disputes

`OracleDispute` records a challenger, reason code, evidence
commitment, status, resolution, and governance reference. AI cannot
unilaterally invalidate facts.

## Authentication

Oracle authentication routes through CryptoSuite and CryptoPolicy.
High-value feeds can require hybrid signatures. The oracle module
does not hard-code a classical algorithm name.

## What this chunk does not implement

- A live market-data or IoT network
- MoonRey issuance
- Official NAV, FX, or fiat-journal authorization
- Chunk 45 machine identity (device provenance fields are reserved)
- Production oracle operators

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
