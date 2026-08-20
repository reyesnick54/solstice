# Chunk 144 — Production Economic Parameter Registry

This chunk builds the machinery that can safely represent future
production economic parameters. It does **not** choose production
tokenomics.

Canonical owner:
`packages/sunrey-chain/src/economics/production-activation/parameter-package`.

Capability: `sunrey-production-economic-parameters`.

## Architecture

```
Typed Parameter Value
        ↓
Candidate Parameter Record
        ↓
Validation
        ↓
Governance Evidence
        ↓
Canonical Parameter Package
        ↓
Package Hash
        ↓
Chunk 143 ProductionParameterRecord
        ↓
Production Activation Firewall
```

The Chunk 143 firewall remains evaluator-only.

## Parameter IDs

The fifteen Chunk 143 `ProductionParameterId` values are reused. This
chunk does not create a second taxonomy.

## What this does not invent

The following remain human/governance decisions:

- SunRey or MoonRey maximum supply
- genesis supplies
- SunRey or MoonRey conversion rates
- issuance caps
- genesis allocations
- production fee values
- production burn values

An explicit governed quantity of `0n` may be valid later. Missing is
`UNCONFIGURED` and is never silently defaulted to zero.

## Value kinds

Each parameter ID maps to exactly one kind:

- `QUANTITY` — bigint minor units plus the existing native protocol precision
- `RATIONAL_CONVERSION` — exact `numerator / denominator` with `denominator > 0`
- `CAP_SCHEDULE` — generic governed caps; asset-specific packages choose scopes
- `ISSUANCE_POLICY_REFERENCE`
- `SUPPLY_GUARD_POLICY`
- `FEE_POLICY_REFERENCE`
- `BURN_POLICY_REFERENCE`
- `GENESIS_ALLOCATION_REFERENCE`

Unknown JSON blobs are rejected. Floats are rejected.

## Source classes

Canonical source classes are:

- `UNCONFIGURED`
- `ENGINEERING_SIMULATION`
- `REHEARSAL_FIXTURE`
- `HUMAN_GOVERNANCE_CANDIDATE`
- `PROTOCOL_GOVERNANCE_CANDIDATE`
- `EXTERNAL_REVIEWED_CANDIDATE`

`sourceClass = "PRODUCTION"` cannot bypass validation. Unknown classes
fail closed.

## Package states

`UNCONFIGURED`, `DRAFT_CANDIDATE`, `ENGINEERING_VALIDATED`,
`EXTERNAL_REVIEW_REQUIRED`, `HUMAN_GOVERNANCE_REQUIRED`,
`GOVERNANCE_CANDIDATE`, `REJECTED`, `SUPERSEDED`.

`PRODUCTION_ACTIVE` is not a package state. Chunk 144 cannot activate
production.

## CONFIGURED vs ACTIVATED

A validated candidate can become a Chunk 143 `ProductionParameterRecord`
with status `CONFIGURED` only through a registered validation receipt.

```
CONFIGURED CANDIDATE  !=  PRODUCTION ACTIVATED
```

A future package could have every numeric parameter selected and still
be blocked by legal, security, regulatory, provider, or human
activation requirements. The firewall remains authoritative.

Manual records such as `{ governed: true, sourceClass: "PRODUCTION",
valueHash, versionId }` do not become `CONFIGURED`.

## Governance

Candidates carry references to existing human/protocol governance
records. A boolean `governed: true` is not sufficient.

AI, S3M, Grok, agents, automation, models, and model output may draft
or analyze. They cannot satisfy required authorization.

## Runtime isolation

Constructing or validating a package does not mutate:

- `monetaryPolicyRegistry`
- `nativeAssetConstitution`
- `AssetSupplyBook`
- genesis
- fees
- burn state
- issuance authority
- `ENVIRONMENT` or `LIVE_*` flags

## Current repository

The current repository package is `UNCONFIGURED`. No production values
are selected.
