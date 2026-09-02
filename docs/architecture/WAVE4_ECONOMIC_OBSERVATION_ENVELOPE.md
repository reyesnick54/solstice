# Wave 4 — EconomicObservationEnvelope

**Status:** Implemented (simulation)  
**Date:** 2026-09-02  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`.  
**Owner:** `packages/sunrey-chain/src/economics/observation`

This document defines the versioned canonical observation envelope that transforms external provider information into a shared economic information contract. The envelope sits between external sources and the Wave 3 economic-proof architecture.

```
Provider-specific response
        ↓
Connector
        ↓
Raw Source Record
        ↓
Normalizer
        ↓
EconomicObservationEnvelope
        ↓
Provenance / Events / Resolution
        ↓
EconomicObservation
        ↓
Evidence / Fact / Claim
```

An `EconomicObservationEnvelope` is **not** a `VerifiedEconomicFact`, does **not** mint native assets, and does **not** set market price.

---

## Table of Contents

1. [Core Invariants](#core-invariants)
2. [Envelope Schema](#envelope-schema)
3. [Normalization Pipeline](#normalization-pipeline)
4. [Unit Architecture](#unit-architecture)
5. [Temporal Architecture](#temporal-architecture)
6. [Geographic Architecture](#geographic-architecture)
7. [Source Preservation](#source-preservation)
8. [Unlabeled Numeric Safety](#unlabeled-numeric-safety)
9. [Schema Evolution](#schema-evolution)
10. [Domain Extensions](#domain-extensions)
11. [Validation and Quarantine](#validation-and-quarantine)
12. [Relationship to Existing Types](#relationship-to-existing-types)
13. [Examples by Domain](#examples-by-domain)

---

## Core Invariants

| Invariant | Value |
|-----------|-------|
| `UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH` | `true` |
| `OBSERVATION_IS_NOT_VERIFIED_FACT` | `true` |
| `NORMALIZED_OBSERVATION_MINTS` | `false` |
| Numeric representation | `bigint` only — no floating point |
| Environment | `simulation` only |

---

## Envelope Schema

**Schema ID:** `sunrey.economic-observation-envelope.v1`  
**Version:** `1`  
**Methodology:** `sunrey.economic-observation.normalization.v1`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `'sunrey.economic-observation-envelope.v1'` | Envelope schema identifier |
| `envelopeVersion` | `1` | Numeric envelope version |
| `envelopeId` | `string` | Unique envelope instance ID |
| `providerId` | `string` | Canonical provider identifier |
| `sourceClass` | `SourceClass` | Source trust class |
| `source` | `SourcePreservation` | Immutable source traceability |
| `subjectOrResourceId` | `string` | Subject or resource reference |
| `canonicalEntityId` | `string \| null` | Resolved entity, if known |
| `eventId` | `string \| null` | Associated event, if known |
| `economicDomain` | `EconomicDomain` | Economic domain classification |
| `category` | `string` | Domain-specific category |
| `metric` | `string` | **Required** — labeled metric name |
| `sourceValue` | `NormalizedQuantity` | Provider-native quantity |
| `normalizedValue` | `NormalizedQuantity` | Canonical quantity |
| `canonicalUnit` | `string` | Target canonical unit |
| `time` | `ObservationTimeWindow` | Temporal context |
| `geography` | `GeographicReference` | Geographic context |
| `provenanceHash` | `string` | Content-addressed provenance |
| `evidenceHash` | `string \| null` | Evidence commitment |
| `rights` | `ObservationRights` | License and consent |
| `freshness` | `ObservationFreshness` | Freshness assessment |
| `confidence` | `ObservationConfidence` | Confidence metadata |
| `verificationStatus` | `ObservationVerificationStatus` | Verification state |
| `disputeStatus` | `DisputeStatus` | Dispute state |
| `duplicateFingerprint` | `string` | Dedup fingerprint |
| `lineageParentIds` | `string[]` | Parent observation lineage |
| `methodologyVersion` | string | Normalization methodology |
| `extension` | `DomainExtension \| null` | Domain-specific metadata |
| `simulation` | `true` | Always simulation |
| `environment` | `'simulation'` | Always simulation |
| `verifiedFact` | `false` | Never a verified fact |
| `mintsNativeAsset` | `false` | Never mints |

### Economic Domains

`ENERGY`, `COMPUTE`, `MANUFACTURING`, `AGRICULTURE`, `RESOURCES`, `LOGISTICS`, `BANDWIDTH`, `WATER`, `REAL_ESTATE`, `RESEARCH`, `WORKFORCE`, `HEALTH_PUBLIC`, `GEOSPATIAL`, `REFERENCE`, `HUMAN_ECONOMY`, `OTHER`

### Source Classes

`SANDBOX_FIXTURE`, `CERTIFIED_CANDIDATE`, `INSTITUTIONAL`, `SENSOR_NETWORK`, `PUBLIC_REFERENCE`, `RESEARCH_PUBLICATION`, `GOVERNMENT_OPEN_DATA`, `REGULATED_PROVIDER`

---

## Normalization Pipeline

**Entry point:** `normalizeRawSourceRecord(record, context)`  
**Batch entry:** `normalizeBatch(records, context)`

### Stages

1. **Validate raw record** — reject missing metric, unit, provider, schema version
2. **Normalize time** — preserve observation window; do not collapse periods
3. **Normalize geography** — apply domain policy (Human Economy minimization)
4. **Normalize units** — bigint canonical conversion via `packages/sunrey-chain/src/units`
5. **Build provenance** — content-addressed hashes
6. **Compute fingerprint** — dedup key
7. **Attach extension** — domain-specific metadata
8. **Emit envelope** or **quarantine**

### Outcomes

```typescript
type NormalizationOutcome =
  | { status: 'ACCEPTED'; envelope: EconomicObservationEnvelope }
  | { status: 'QUARANTINED'; quarantineId: string; code: string; message: string };
```

---

## Unit Architecture

**Constitution:** `sunrey.economic-unit.normalization.v1` (Chunk 118)  
**Implementation:** `packages/sunrey-chain/src/economics/observation/units.ts`

### Principles

- Exact `bigint` arithmetic only
- Domain-scoped unit families — no cross-domain mixing
- Dimensional safety — **MW ≠ MWh** (power vs energy)
- Delegates to canonical unit catalog (`packages/sunrey-chain/src/units/catalog.ts`)

### Domain Unit Families (examples)

| Domain | Allowed Units |
|--------|---------------|
| ENERGY | `Wh`, `kWh`, `MWh`, `GWh`, `J` |
| COMPUTE | `GPU_HOUR`, `CPU_HOUR`, `gpu_s`, `token_inference` |
| MANUFACTURING | `units_produced`, `UNIT`, `kg`, `tonne` |
| AGRICULTURE | `kg`, `tonne` |
| BANDWIDTH | `B_s`, `GB_s`, `GB`, `TB` |
| RESEARCH | `UNIT` (count semantics) |

### Rejection Codes

`MISSING_UNIT`, `UNIT_UNKNOWN`, `UNIT_INCOMPATIBLE`, `DIMENSION_MISMATCH`, `FLOAT_FORBIDDEN`

---

## Temporal Architecture

**Version:** `sunrey.economic-observation.time.v1`

### Fields

| Field | Description |
|-------|-------------|
| `observedAt` | Canonical observation instant (UTC) |
| `periodStart` | Period aggregate start (UTC), if applicable |
| `periodEnd` | Period aggregate end (UTC), if applicable |
| `receivedAt` | Ingestion receipt time (UTC) |
| `isInstantaneous` | Point-in-time observation |
| `isPeriodAggregate` | Period-bound aggregate |
| `sourceTimezonePreserved` | Original timezone label, if provided |

### Rules

- All canonical times are UTC (`UtcInstant`)
- Monthly production figures remain period aggregates — **not** converted to instantaneous events
- Period aggregates require both `periodStart` and `periodEnd`
- `periodStart` must precede `periodEnd`

---

## Geographic Architecture

**Version:** `sunrey.economic-observation.geography.v1`

### GeographicReference

| Field | Description |
|-------|-------------|
| `precision` | `COUNTRY`, `REGION`, `CITY`, `FACILITY`, `COORDINATES`, `BOUNDS`, `JURISDICTION_ONLY`, `REDACTED`, `NOT_DISCLOSED` |
| `country` | ISO-style country code |
| `region` | Region/state |
| `city` | City |
| `jurisdiction` | Legal jurisdiction |
| `coordinates` | Lat/lon (when permitted) |
| `bounds` | Geospatial bounding box |
| `facilityRef` | Facility reference |
| `resourceRef` | Resource reference |
| `gridZone` | Grid/balancing zone |
| `publicDisclosureAllowed` | Disclosure permission |

### Human Economy Policy

Precise personal coordinates require `publicDisclosureAllowed: true`. Without explicit consent, observations with coordinates in `HUMAN_ECONOMY` domain are rejected with `GEOGRAPHY_POLICY_VIOLATION`.

---

## Source Preservation

Every normalized observation retains full traceability:

```typescript
type SourcePreservation = {
  providerId: string;
  sourceRecordId: string;
  sourceDatasetId: string;
  providerSchemaVersion: string;
  providerSchemaId: string;
  provenanceRef: string;
  rawValueRef: string | null;  // hash of raw payload when present
};
```

Normalization **never** erases provider identity. The `provenanceHash` and `evidenceHash` are content-addressed commitments over source + normalized value.

---

## Unlabeled Numeric Safety

**Principle:** `UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH`

Observations are rejected (quarantined) when:

- `metric` is missing or empty
- `unit` is missing or empty
- `value` is not `bigint`
- Time context is missing where required
- Entity/resource is ambiguous beyond policy limits

The normalizer **does not guess units**.

---

## Schema Evolution

Provider API schema changes must not silently reinterpret old records.

### Adapter Boundaries

| Provider Schema | Supported Versions |
|-----------------|-------------------|
| `energy.grid-generation.v1` | `[1]` |
| `compute.gpu-utilization.v1` | `[1]` |
| `manufacturing.output.v1` | `[1]` |
| `agriculture.yield.v1` | `[1]` |
| `research.publication-metrics.v1` | `[1]` |
| `workforce.employment.v1` | `[1]` |
| `health.public-surveillance.v1` | `[1]` |
| `geospatial.reference.v1` | `[1]` |

Unsupported schema versions are rejected with `SCHEMA_VERSION_UNSUPPORTED`. New versions require explicit adapter registration in `SUPPORTED_PROVIDER_SCHEMA_VERSIONS`.

---

## Domain Extensions

Domain-specific metadata uses typed extensions rather than bloating the shared envelope:

| Extension Kind | Example Fields |
|----------------|----------------|
| `ENERGY` | `generationType`, `fuelType`, `gridInterconnection` |
| `COMPUTE` | `acceleratorType`, `workloadClass`, `tokenDirection` |
| `MANUFACTURING` | `productSku`, `productionLine` |
| `AGRICULTURE` | `cropType`, `harvestSeason` |
| `RESEARCH` | `publicationId`, `doi`, `peerReviewed` |
| `WORKFORCE` | `occupationCode`, `employmentType` |
| `HEALTH_PUBLIC` | `conditionCode`, `surveillanceSystem` |
| `GEOSPATIAL` | `featureType`, `crs`, `resolutionMeters` |
| `GENERIC` | Key-value fallback |

---

## Validation and Quarantine

Invalid records enter a **quarantine path**. They do not silently disappear and do not become `VerifiedEconomicFacts`.

### Rejection Codes

`UNLABELED_NUMERIC`, `MISSING_METRIC`, `MISSING_UNIT`, `UNIT_UNKNOWN`, `UNIT_INCOMPATIBLE`, `DIMENSION_MISMATCH`, `FLOAT_FORBIDDEN`, `MISSING_TIME_CONTEXT`, `INVALID_TIME_WINDOW`, `MISSING_SOURCE_ID`, `MISSING_PROVIDER_ID`, `MISSING_PROVENANCE`, `GEOGRAPHY_POLICY_VIOLATION`, `ENTITY_AMBIGUOUS`, `SCHEMA_VERSION_UNSUPPORTED`, `LICENSE_FORBIDDEN`, `DUPLICATE_FINGERPRINT`

### Quarantine Registry

```typescript
const registry = createQuarantineRegistry();
normalizeRawSourceRecord(record, { nowUtc, quarantine: registry });
// Rejected records are stored in registry.list()
```

---

## Relationship to Existing Types

| Existing Type | Relationship |
|---------------|-------------|
| `ExternalObservation<T>` (provider-sdk) | Transport/provenance shell; envelope composes above it conceptually |
| `EconomicDataCollectionEnvelope` (oracle fabric) | Oracle admission path; fabric envelopes promote to observation envelopes |
| `EconomicObservation` (economy-data) | Phase H productive observation; future bridge from envelope |
| `CanonicalProductiveMeasurement` (units) | Physical measurement authority; envelope delegates unit conversion |

The `EconomicObservationEnvelope` is a **composition layer**, not a fourth parallel envelope.

---

## Examples by Domain

### Energy — Instantaneous Generation

```typescript
const record: RawSourceRecord = {
  schemaVersion: 'sunrey.economic-raw-source-record.v1',
  providerId: 'uk-grid-sandbox',
  sourceRecordId: 'rec-energy-001',
  sourceDatasetId: 'uk-generation-hourly',
  providerSchemaId: 'energy.grid-generation.v1',
  providerSchemaVersion: '1',
  sourceClass: 'SANDBOX_FIXTURE',
  subjectOrResourceId: 'plant:wind-farm-42',
  economicDomain: 'ENERGY',
  category: 'generation',
  metric: 'energy_generated',
  value: 2500n,
  unit: 'MWh',
  observedAt: '2026-08-30T12:00:00.000Z',
  receivedAt: '2026-08-30T12:05:00.000Z',
  aggregationHint: 'INSTANT',
  geography: { country: 'GB', jurisdiction: 'GB', gridZone: 'UK-GB' },
  extensionFields: { generationType: 'WIND' },
};

const outcome = normalizeRawSourceRecord(record, { nowUtc: '2026-08-30T12:05:00.000Z' });
// outcome.envelope.normalizedValue.mantissa === 2_500_000_000n (Wh)
// outcome.envelope.extension.kind === 'ENERGY'
```

### Energy — Monthly Period Aggregate

```typescript
const record = {
  // ...
  metric: 'monthly_generation',
  value: 75_000n,
  unit: 'MWh',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-08-31T23:59:59.000Z',
  aggregationHint: 'PERIOD',
  observedAt: null,
};
// outcome.envelope.time.isPeriodAggregate === true
// outcome.envelope.time.isInstantaneous === false
```

### Compute — GPU Utilization

```typescript
const record = {
  economicDomain: 'COMPUTE',
  metric: 'gpu_hours',
  value: 48n,
  unit: 'GPU_HOUR',
  extensionFields: { acceleratorType: 'H100', workloadClass: 'INFERENCE' },
};
// outcome.envelope.extension.kind === 'COMPUTE'
```

### Rejected — Unlabeled Numeric

```typescript
const record = { metric: '', unit: 'MWh', value: 100n, /* ... */ };
const outcome = normalizeRawSourceRecord(record, { nowUtc });
// outcome.status === 'QUARANTINED'
// outcome.code === 'UNLABELED_NUMERIC'
```

### Rejected — Dimensional Error (MW vs MWh)

```typescript
refuseDimensionalMix('MW', 'MWh'); // true — power ≠ energy
```

---

## File Layout

```
packages/sunrey-chain/src/economics/observation/
  types.ts          — Envelope schema and constants
  source.ts         — RawSourceRecord and source preservation
  time.ts           — Temporal normalization
  geography.ts      — Geographic reference model
  units.ts          — Unit normalization facade
  extensions.ts     — Domain-specific extensions
  fingerprint.ts    — Duplicate fingerprint
  validation.ts     — Strict validation
  quarantine.ts     — Quarantine registry
  normalize.ts      — Normalization pipeline
  fixtures.ts       — Test fixtures
  index.ts          — Public API
tests/wave-4-economic-observation-envelope.test.ts
```

---

## Tests

Run:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test --test-reporter=spec tests/wave-4-economic-observation-envelope.test.ts
```

Coverage includes: energy, compute, manufacturing, agriculture, research, workforce, health-public, geospatial fixtures; unit conversions; bad/missing units; time windows; source preservation; schema versions; duplicate fingerprints; jurisdiction; rights/license metadata; sensitive data minimization.
