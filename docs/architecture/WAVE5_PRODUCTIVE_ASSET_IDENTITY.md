# Wave 5 Productive Asset Identity

**Version:** 1.0.0-wave5-asset-identity  
**Status:** Simulation implementation  
**Owner:** `packages/sunrey-chain/src/productive/asset-identity`  
**Companion:** `docs/architecture/WAVE3_ECONOMIC_CLAIMS_AND_DEDUPLICATION.md`, `packages/sunrey-chain/src/economic-proof/entity-identity.ts`

---

## 1. Problem statement

Before SunRey can understand productive contribution, it must reliably determine **what produced something**.

The same power plant appearing in:

- government data (EIA plant id)
- operator API (operator asset id)
- satellite dataset (geometry id)
- utility API (provider record id)

must be capable of resolving to **one** canonical productive asset (`P-######`).

Likewise, one factory, data center, farm, logistics facility, or water asset must not multiply economically merely because different systems use different identifiers.

**Core invariant:**

```
MULTIPLE PROVIDER IDENTIFIERS ≠ MULTIPLE PRODUCTIVE ASSETS
```

**Consolidation invariant:**

```
ONLY POLICY-APPROVED CONFIDENCE MAY AUTO-MERGE PRODUCTIVE ASSETS
```

---

## 2. Pre-Wave 5 audit (Task 1)

See `packages/sunrey-chain/src/productive/asset-identity/audit.ts`.

| Surface | Identifiers | Durable? | Weakness |
| --- | --- | --- | --- |
| `ProductiveAssetRegistry` (economy-data) | `resourceId` | No | Sandbox resource ids; no cross-provider alias graph |
| `ProductiveEconomicObject` | `objectId`, owner/controller/operator refs | No | Owner-registry scoped; no alias registry |
| `ProductiveResourceRecord` | `resourceId`, `ownerRef`, `operatorRef` | No | Limited lifecycle; no alias resolution |
| Economic proof entity identity | `canonicalEntityId`, `entityCommitment` | Yes | Human alias fixtures only |
| Wave 5 PEG snapshot | Observation-derived `nodeId` | No | Projection labels, not facility identity |
| Economic Asset Registry adapter | Master registry `assetId` | Yes | Metadata/rights plane, not facility resolver |

Wave 5 adds durable canonical productive asset identity without weakening Chunk 44/Phase H owners.

---

## 3. Canonical productive asset

`CanonicalProductiveAsset` (`types.ts`) fields:

| Field | Purpose |
| --- | --- |
| `productiveAssetId` | Durable canonical id (`P-000482`) |
| `schemaVersion` | `sunrey.productive.asset-identity.v1` |
| `assetClass` | POWER_PLANT, FACTORY, DATA_CENTER, FIELD, … |
| `productiveCategory` | Chunk 44 productive category |
| `economyCategory` | Phase H economy-data category when applicable |
| `parties` | OWNER / OPERATOR / CONTROLLER / DATA_PROVIDER |
| `geography` | Jurisdiction + committed coordinates |
| `jurisdiction` | Regulatory / geographic scope |
| `commissionedAtUtc` / `retiredAtUtc` | Lifecycle anchors |
| `lifecycle` | PLANNED, ACTIVE, DEGRADED, SUSPENDED, RETIRED, UNKNOWN |
| `capacityMetadata` / `technologyMetadata` | Non-sensitive structured metadata |
| `externalIdentifiers` | Committed official / operator / registry ids |
| `verificationStatus` | UNVERIFIED → VERIFIED / DISPUTED |
| `sourceReferences` / `rightsReferences` | Provenance and licensing hooks |
| `parentAssetId` / `rollupBehavior` | Hierarchy and double-count guards |
| `fingerprint` | Deterministic duplicate-detection digest |

Ownership data is optional. Operator and data-provider references are modeled separately.

---

## 4. Identity resolution

Canonical identity does **not** depend solely on:

- provider name
- provider record id
- display name

Resolution uses committed combinations (`resolution.ts`):

- official facility id
- operator asset id
- government registry id
- coordinates commitment
- technology + commissioning year
- registered aliases

### Confidence levels

| Level | Meaning | Auto-merge |
| --- | --- | --- |
| `EXACT` | Strong alias or registry id match | Allowed |
| `PROBABLE` | Multiple corroborating hints | Blocked by default |
| `POSSIBLE` | Weak name-only or partial hints | Blocked |
| `CONFLICT` | Equal-score candidates | Blocked |
| `NO_MATCH` | No candidate | Register new asset |

Only `EXACT` passes `policyAllowsAutomatedConsolidation()`.

---

## 5. Alias registry

Extends Wave 3 `EntityAliasResolver` / Wave 4 alias architecture.

Example:

```
EIA plant id 123          → P-000482
operator asset ABC        → P-000482
satellite geometry XYZ    → P-000482
```

Every source-specific alias is preserved in `ProductiveAssetAliasRegistry`. Alias collisions mapping to different canonical assets fail closed.

Alias kinds: `EIA_PLANT_ID`, `OPERATOR_ASSET_ID`, `GOVERNMENT_REGISTRY_ID`, `ENTERPRISE_ID`, `PROVIDER_RECORD_ID`, `SATELLITE_GEOMETRY`, `COORDINATES`, `DISPLAY_NAME`, `RESOURCE_ID`.

---

## 6. Lifecycle model

Supported states:

```
PLANNED → ACTIVE → DEGRADED → SUSPENDED → RETIRED
                     └──────── UNKNOWN
```

`lifecycleAllowsProduction()` rejects attribution when:

- asset is `PLANNED`, `SUSPENDED`, `RETIRED`, or `UNKNOWN`
- event precedes commissioning
- event occurs on or after retirement

Example: a retired plant reporting production after retirement returns `RETIRED_BEFORE_EVENT` for review.

---

## 7. Ownership vs operation

`PartyReference.role` distinguishes:

| Role | Meaning |
| --- | --- |
| `OWNER` | Title / economic ownership when authorized |
| `OPERATOR` | Day-to-day operational control |
| `CONTROLLER` | Governance or contractual controller |
| `DATA_PROVIDER` | Source system publishing observations |

Provider ≠ operator. Operator ≠ owner.

---

## 8. Hierarchy and rollup

Supported tree:

```
DataCenter
  └── ComputeCluster
       └── AcceleratorPool

Factory
  └── ProductionLine

PowerPlant
  └── GenerationUnit

Farm
  └── Field
```

`rollupBehavior`:

- `INDEPENDENT` — report at this asset only
- `ROLLS_UP_TO_PARENT` — child output rolls into parent
- `AGGREGATES_CHILDREN` — parent aggregates explicit children

`assessProductionRollup()` marks `doubleCountRisk` when parent and rolling-up child would be summed.

---

## 9. Fingerprinting

`deriveAssetFingerprint()` hashes committed, non-sensitive material:

- asset class + jurisdiction + region/locality
- coordinates commitment
- official / operator / government registry commitments
- technology + commissioning year

Raw coordinates, display names, and provider payloads are committed via `commitment.ts` — not embedded verbatim in public fingerprints.

---

## 10. Persistence

`ProductiveAssetIdentityRegistry.snapshot()` / `restore()` persist:

- canonical assets
- alias registry
- hierarchy edges
- sequence counter for `P-######` ids

Identity survives process restart. Canonical identity is not kept solely in memory.

---

## 11. Implementation map

| Module | Responsibility |
| --- | --- |
| `types.ts` | Canonical asset, alias, hierarchy, resolution types |
| `commitment.ts` | Value commitments without raw sensitive payloads |
| `fingerprint.ts` | Deterministic asset fingerprint |
| `alias.ts` | Alias registry |
| `resolution.ts` | Confidence-scored identity resolution |
| `lifecycle.ts` | Lifecycle guards for production attribution |
| `hierarchy.ts` | Parent/child lineage and rollup assessment |
| `registry.ts` | `ProductiveAssetIdentityRegistry` orchestration |
| `audit.ts` | Pre-Wave 5 identifier audit |
| `fixtures.ts` | Collision scenario fixtures |
| `productive-identity.test.ts` | Wave 5 identity tests |

---

## 12. Validation

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test --test-reporter=spec \
  packages/sunrey-chain/src/productive/asset-identity/productive-identity.test.ts

# Prior wave regression (representative)
npm test
```

---

## 13. Remaining gaps (Wave 5+)

- PostgreSQL-backed durable alias store (bounded database migration)
- Live provider ingestion binding to canonical asset resolution
- Governance workflow for `PROBABLE` / `POSSIBLE` merge approval
- Cross-link from `ProductiveResourceRecord.resourceId` to `productiveAssetId` in ingestion path
