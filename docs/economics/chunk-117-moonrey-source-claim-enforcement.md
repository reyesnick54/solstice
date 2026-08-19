# Chunk 117 — MoonRey Source / Fact / Claim Compatibility Enforcement

Chunk 116 created the canonical semantic mapping:

```
DataSourceCategory → FactType → ProductiveCategory → Unit → ClaimType
```

Chunk 117 makes that mapping **enforceable**. Semantically invalid
economic data cannot enter the MoonRey productive-contribution
pathway.

Canonical owner: `packages/sunrey-chain`  
Implementation: `packages/sunrey-chain/src/oracle/source-taxonomy`  
Claim-candidate adapter: `packages/sunrey-chain/src/productive/claim-candidate`

This chunk **extends** the existing `sunrey-production-oracles` and
`sunrey-productive-capacity` capabilities. It does not create a second
oracle, productive registry, mint, or economic-asset registry.

## What it enforces

A deterministic validator returns `COMPATIBLE` or a coded rejection
for a `(source category, fact type, source unit, productive category,
claim type)` tuple.

Rejection codes include:

- `SOURCE_CATEGORY_UNKNOWN`
- `SOURCE_CATEGORY_RETIRED`
- `FACT_NOT_ALLOWED_FOR_SOURCE`
- `FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY`
- `PRODUCTIVE_CATEGORY_UNMAPPED`
- `SOURCE_UNIT_NOT_ALLOWED`
- `CLAIM_TYPE_NOT_ALLOWED`
- `REFERENCE_DATA_CANNOT_CREATE_CLAIM`
- `PRODUCTIVE_OBJECT_REQUIRED`
- `RIGHTS_REQUIRED`
- `MEASUREMENT_PERIOD_REQUIRED`
- `GEOGRAPHY_REQUIRED`
- `VERIFIED_FACT_REQUIRED`
- `QUORUM_REQUIRED`
- `ATTRIBUTION_POLICY_REQUIRED`
- `MAPPING_VERSION_MISMATCH`
- `MAPPING_SUPERSEDED`

Examples:

- energy + `ENERGY_PRODUCTION` + kWh → valid
- energy + `SERVICE_DELIVERY` → invalid
- `reference_price` + `REFERENCE_PRICE` → valid reference data
- `reference_price` + OUTPUT claim → invalid

## Production source and feed onboarding

Mapping validation is an **additional** filter on:

- `EconomicDataSourceRegistry.register`
- production feed definition / CLI `feed create|validate`

It does not weaken existing onboarding, security-review, commercial
evidence, credential, schema, or independence checks.

## Productive claim candidates

`ProductiveClaimCandidateBuilder` consumes:

- a registered `ProductiveEconomicObject`
- a `VerifiedEconomicFact`
- a `SourceProductiveMapping`

and returns a `ProductiveClaimCandidate`, **not** a verified
`ProductiveClaim`.

The candidate records `mappingId` / `mappingVersion`, quantity,
source unit, period, geography, rights, and oracle references.
`automaticIssuance` is always `false`. The candidate does not
auto-verify and does not mint.

Before a fact can support a candidate:

- the fact subject must match the productive object
- the productive category must match
- rights / controller must be compatible
- geography must match where the mapping requires it
- the measurement period must be defined and overlap the fact window
- only `VERIFIED` / non-stale / non-conflicted facts pass

A legitimate energy fact for Plant A cannot support a claim for
Plant B.

Oracle consensus is consumed, not changed.

## Claim submission

Callers cannot manually submit a CAPACITY fact as OUTPUT, a reference
price as DELIVERY, or a service-delivery fact as ENERGY.
`gateMappedClaimSubmission` is an additional filter in front of the
existing rights / quorum / fingerprint / policy checks.

## Mapping version traceability

Every candidate created through this path retains `mappingId` and
`mappingVersion`. If a mapping is later superseded, historical
candidates and claims keep the original version. New claims cannot
use a superseded mapping. There is no silent reinterpretation.

## Attribution-policy gate

Where a mapping sets `requiresAttributionPolicy: true` (overlap-risk
routes such as manufacturing output → goods / automated machine
output), development simulation claims are not automatically
rejected. The state is explicit:

- `ATTRIBUTION_REVIEW_REQUIRED`, or
- an approved simulation attribution-policy reference

(`ATTRIBUTION_POLICY_COMPLETE=false`)

This does not solve duplicate attribution. It prepares for a later
cross-domain attribution chunk.

## Coverage report

`moonreySourceCoverageReport()` shows, for every `ProductiveCategory`:

- source categories, fact types, units, claim types
- mapping status
- attribution / overlap-risk flags

After this chunk:

```
unmappedProductiveCategories = []
coveragePercent = 100
```

## Economic asset registry lineage

When Chunk 113/115 is available, the compatibility path can record:

```
ORACLE_SOURCE_DATASET
  → ORACLE_OBSERVATION_SET
  → VERIFIED_ECONOMIC_FACT
  → PRODUCTIVE_CLAIM
  → VERIFIED_PRODUCTIVE_CONTRIBUTION
```

Registry availability is **not** a minting dependency. A missing
registry leaves the candidate path unchanged. Registration never
authorizes MoonRey issuance.

## What this chunk does not do

- live provider calls
- productive valuation changes
- MoonRey tokenomics changes
- automatic issuance
- production activation

```
PRODUCTIVE_CATEGORY_GAPS=0
VERIFIED_FACT_ALONE_CAN_MINT=false
CLAIM_CANDIDATE_ALONE_CAN_MINT=false
ATTRIBUTION_POLICY_COMPLETE=false
PRODUCTION_ACTIVE=false
```
