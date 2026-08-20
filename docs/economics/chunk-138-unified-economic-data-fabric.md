# Chunk 138 — Unified Multi-Provider Economic Data Fabric

This chunk completes the first major real-world economic data fabric
program. It sits **above** provider-family adapters (Chunks 129–137) and
**below** the existing oracle consensus engine.

It is not another oracle consensus engine.
It is not another Productive Registry.
It is not another attribution engine.
It is not another Economic Asset Registry.
It is not another mint.

## Architecture

```
External Economic Sources
        ↓
Provider-Family Adapter
        ↓
Secure Connector Runtime
        ↓
Certification / Admission
        ↓
Economic Data Fabric
        ↓
Oracle Observation
        ↓
Oracle Consensus
        ↓
Verified Economic Fact
        ↓
Productive Claim
        ↓
Verified Productive Contribution
        ↓
Economic Event Identity
        ↓
Attribution
        ↓
Productive Value Function
        ↓
GPUV
        ↓
Governed MoonRey Conversion
        ↓
Chunk 71 MonetaryIssuanceAuthority
        ↓
Canonical MoonRey AssetSupplyBook
```

## Owner

`packages/sunrey-chain/src/oracle/production/economic-data-fabric`

Capability: `sunrey-unified-economic-data-fabric`
Parent owner: `sunrey-production-oracles`

Do not create `packages/economic-data-fabric`, `packages/unified-oracles`,
`packages/cross-domain-reconciliation`, or `packages/moonrey-data-fabric`.

## Provider family registry

`EconomicDataProviderFamilyRegistry` is an operational routing index.
Canonical source semantics remain Chunk 116 `SourceProductiveMapping`.
The registry verifies compatibility with that taxonomy and does not
redefine `DataSourceCategory`, `FactType`, `ProductiveCategory`, or
`ClaimType`.

Registered family identities:

| Family | Implementation |
| --- | --- |
| ENERGY | Chunk 129 adapter |
| COMPUTE | Chunk 130 adapter |
| AI_COMPUTE | Chunk 130 adapter |
| MANUFACTURING | Chunk 131 adapter |
| AUTOMATED_MACHINE_OUTPUT | Chunk 131 adapter |
| LOGISTICS | Chunk 132 adapter |
| STORAGE | Chunk 132 adapter |
| MINERALS_RESOURCES | Chunk 133 adapter |
| AGRICULTURE_FOOD | routing index; dedicated adapter not on main |
| WATER | routing index; dedicated adapter not on main |
| REAL_ESTATE | routing index; dedicated adapter not on main |
| INFRASTRUCTURE | routing index; dedicated adapter not on main |
| BANDWIDTH | routing index; dedicated adapter not on main |
| GOODS | routing index; dedicated adapter not on main |
| SERVICES | routing index; dedicated adapter not on main |
| REFERENCE_DATA | cross-domain reference path |

Coverage gaps for routing-index families are reported, never faked.

`productionActivated` is always `false`. `liveProviderConnected` is
always `false`.

## Collection envelope

`EconomicDataCollectionEnvelope` stores references, commitments,
canonical measurements, and provenance metadata. It does not store:

- personal raw data or customer PII
- farm raw records
- network packet content
- AI prompts
- factory recipes
- GPS trails
- API credentials, OAuth tokens, or private keys
- industrial control payloads

`payloadStored` and `credentialsPresent` are always `false`.

## Admission

Before an envelope is eligible for oracle submission the fabric requires:

- registered provider family
- registered source
- approved endpoint profile
- valid connector result
- schema validation
- canonical unit normalization
- source-taxonomy compatibility
- current certification status
- provider/source not suspended
- freshness policy
- provenance completeness

Modes: `FIXTURE_ONLY`, `ENGINEERING_SANDBOX`, `TESTNET_ADMISSIBLE`,
`PRODUCTION_CANDIDATE`. There is no `PRODUCTION_LIVE`.

Expired or revalidation-required certifications fail the requested mode.

## Routing

Each accepted source routes to exactly one family. Ambiguous
source/fact pairs are refused. A provider cannot self-label an
arbitrary productive category.

`REFERENCE_PRICE` is always `REFERENCE_DATA`:

- `productiveCategory = null`
- `canCreateProductiveClaim = false`
- `canMint = false`

Price is not value.

## Observation grouping and independence

Grouping keys: fact type, subject, measurement period, geography, unit
semantics. Grouping prepares data for the **existing** oracle engine.
The fabric does not aggregate a `VerifiedEconomicFact`.

Independence uses controller / upstream organization / shared-control
evidence. API endpoints are not independent parties.

## Correlation and lineage

Cross-family duplicate signals emit
`EconomicEventCorrelationCandidate` to the existing event-identity /
attribution system. Confidence is conservative:

- `AUTHORITATIVE_REFERENCE`
- `STRONG_CORRELATION`
- `POSSIBLE_CORRELATION`
- `NO_CORRELATION`

Same quantity, nearby time, or same controller alone never merge
events. Strong lineage / batch / object evidence is required.

Lineage examples (ownership is not transferred):

- energy production → manufacturing energy input
- water production → agricultural irrigation input
- resource extraction → manufacturing input
- agricultural output → food-processing input
- manufacturing output → goods batch
- goods batch → logistics shipment
- logistics delivery → warehouse storage
- compute execution → AI service

## Conflicts

Obvious cross-provider disagreements (same subject, interval, and fact
type with a material quantity spread) are reported as unresolved
candidates. Existing oracle consensus and dispute architecture remain
authoritative.

## Coverage

`EconomicDataFabricCoverageReport` accounts for every canonical
`DataSourceCategory`, `ProductiveCategory`, and `FactType`. Fact types
are classified as `PRODUCTIVE_SOURCE`, `REFERENCE_ONLY`,
`CAPACITY_ONLY`, `REALIZED_OUTPUT`, `USAGE`, `DELIVERY`, or `RESERVE`.
No active fact disappears silently.

Expected current state:

- `liveProviderConnected = false` for every family
- routing-index families report schema / certification gaps
- unmapped taxonomy rows are listed, not invented

## Batch ingestion

Bounded batches (`FABRIC_MAX_BATCH_SIZE = 64`), deterministic order,
per-record results, partial-failure isolation, idempotency, and
content commitments. One bad record cannot corrupt good records.
Partial provider success is not oracle quorum.

## Economic Asset Registry

The fabric may project a source dataset, observation-set, or
verified-fact descriptor through the existing oracle adapter. It is
not the registry source of truth.

## Authority firewall

```
HTTP_FETCH_SUCCESS
  ≠ VERIFIED_ECONOMIC_FACT
  ≠ PRODUCTIVE_CONTRIBUTION
  ≠ PRODUCTIVE_VALUE
  ≠ MOONREY_ISSUANCE
```

- Connector runtime cannot finalize facts
- Certification cannot finalize facts
- Data fabric cannot finalize facts
- Oracle facts cannot mint
- Economic event identity cannot mint
- Attribution cannot mint
- Productive Value cannot mint
- Conversion authorization still requires Chunk 71
- `AssetSupplyBook` remains canonical supply

## Simulation

`demo:moonrey-unified-economic-data-fabric` is **SIMULATION ONLY**.

Representative families demonstrate:

sandbox record → connector runtime → certification → collection
envelope → signed `OracleObservation` → existing oracle aggregation →
`VerifiedEconomicFact`

Then stop.

An optional ENERGY and MANUFACTURING path may continue through the
existing governed simulation stack to Chunk 71 and `AssetSupplyBook`.
The fabric does not mint MoonRey.
