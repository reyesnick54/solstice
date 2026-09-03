# ADR-0035 Economic Awareness Fabric canonicalization

**Engineering status:** ACCEPTED_FOR_ENGINEERING  
**Legal / regulatory confidence:** RESEARCH_REQUIRED — not a legal opinion  
**Affected subsystem:** ECONOMIC_AWARENESS / INFORMATION_CONSENSUS  
**Depends on:** sunrey-chain, economic-proof, provider-sdk, economic-awareness-fabric (orchestration)  
**Implementation status:** IMPLEMENTED (simulation)

## Context

Wave 4 introduced Economic Awareness Fabric (EAF) to observe, normalize, and
corroborate external economic information before governed downstream systems
(Wave 3 economic proof, issuance gates, productive value) may act on it.

Two implementations existed:

1. `packages/economic-awareness-fabric` — federated orchestration (ingestion,
   normalization, federation, entity resolution, reputation).
2. `packages/sunrey-chain/src/economic-awareness-fabric` — authoritative
   Information Consensus with source-independence semantics.

The standalone package duplicated weaker corroboration logic that counted raw
observations without lineage analysis. Three providers copying the same upstream
source could falsely satisfy quorum. This violated the fundamental invariant:

> Multiple observations derived from the same upstream information source must
> not be treated as multiple independent sources.

## Decision

Establish **one canonical semantic authority** for Information Consensus:

| Concern | Canonical owner |
| --- | --- |
| Source independence analysis | `packages/sunrey-chain/src/economic-awareness-fabric/information-consensus/independence.ts` |
| Lineage-aware corroboration | `packages/sunrey-chain/src/economic-awareness-fabric/information-consensus/corroboration.ts` |
| Information Consensus engine | `packages/sunrey-chain/src/economic-awareness-fabric/information-consensus/engine.ts` |
| Verified economic fact (information layer) | `packages/sunrey-chain/src/economic-awareness-fabric/information-consensus/verified-fact.ts` |
| Federated orchestration | `packages/economic-awareness-fabric` (thin public adapter) |

### Public API boundary

Consumers must import through supported package exports:

- `@solstice/sunrey-chain/economic-awareness-fabric` — canonical Information
  Consensus semantics.
- `@solstice/economic-awareness-fabric` — orchestration plus re-exports of
  canonical consensus under `informationConsensus`, `corroboration`, and
  `consensus` namespaces.

Deep imports into `another-package/src/**` for EAF types or consensus behavior
are prohibited.

### Source independence rule

Corroboration groups observations by `lineageRootId` and `upstreamOrganizationId`.
`independentLineageRootCount` — not `rawObservationCount` or `rawProviderCount`
— determines whether independent-source quorum is met. Endpoint count is not
independence (`endpointCountIsNotIndependence: true`).

### Corroboration semantics

Methodology policies define `minimumIndependentClasses` and
`requiredSourceClasses`. A rule is satisfied only when:

1. Observation count meets `minimumObservations`, and
2. Distinct independent source classes are present, and
3. `independentLineageRootCount >= minimumIndependentClasses`.

Consensus is never reduced to `observations.length >= threshold`.

### Monetary authority separation

EAF and Information Consensus describe economic reality. They do not possess
monetary issuance authority:

- `INFORMATION_CONSENSUS_CREATES_MONEY === false`
- `INFORMATION_CONSENSUS_GRANTS_EXECUTION_AUTHORITY === false`
- Verified facts and receipts set `grantsMonetaryAuthority: false`
- Canonical Economic Claims are inputs to later governed systems (Chunk 71
  issuance gate, Execution Authority), not permission to mint.

### Flow

```
External sources
    → EAF orchestration (ingest, normalize, provenance, federation)
    → NormalizedEconomicObservation
    → Information Consensus (independence + corroboration + conflicts + freshness)
    → InformationVerifiedEconomicFact / receipt
    → Downstream governed systems (economic proof, issuance gate, productive value)
```

Information Consensus never posts journals, mutates supply, or issues Execution
Authority.

### Migration from duplicate implementation

Removed from `packages/economic-awareness-fabric`:

- `src/corroboration/engine.ts` (count-based corroboration without lineage)
- `src/consensus/input.ts` (conflicting `InformationConsensusInput` type)

Replaced with re-exports from `@solstice/sunrey-chain/economic-awareness-fabric`.

### Prohibited dependency directions

- EAF / Information Consensus must not import ledger, permissions Execution
  Authority issuers, or issuance mutators.
- Library packages must not import `services/**`.
- Consumers must not deep-import `packages/*/src/**` for EAF semantics; use
  package exports.
- Information Consensus must not be reimplemented in orchestration or application
  layers.

## Consequences

- One semantic authority for corroboration and consensus; orchestration remains
  a separate, non-authoritative coordination layer.
- Regression tests A–G lock source-independence and monetary-authority
  invariants in `packages/economic-awareness-fabric/src/canonical-regression.test.ts`.
- Existing Wave 4 integration tests remain valid via public package imports.

This ADR is not `CONFIRMED_BY_COUNSEL`.
