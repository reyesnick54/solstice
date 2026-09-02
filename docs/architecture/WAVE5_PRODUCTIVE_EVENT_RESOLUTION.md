# Wave 5 Productive Event Resolution

**Version:** 1.0.0-wave5-prompt1  
**Status:** Simulation implementation  
**Owner:** `packages/sunrey-chain/src/economic-proof`  
**Companion:** `docs/architecture/WAVE3_ECONOMIC_CLAIMS_AND_DEDUPLICATION.md`

---

## 1. Problem statement

The Oracle Mesh can produce many observations about productive activity. Wave 5
determines when those observations represent **one** productive event versus
**multiple** productive events.

**Core invariant:**

```
N OBSERVATIONS OF ONE EVENT = ONE PRODUCTIVE EVENT
```

not:

```
N PRODUCTIVE EVENTS
```

Without resolution, MoonRey economic inflation occurs when corroborating sources
are naïvely summed (500 MWh × 5 sources ≠ 2,500 MWh).

---

## 2. Relationship to Wave 3

Wave 5 **extends** Wave 3 mechanisms — it does not create a parallel
deduplication system:

| Wave 3 mechanism | Wave 5 extension |
| --- | --- |
| `canonicalEventId` | `deriveCanonicalEventIdFromKey` binds reconciled quantity |
| `ProductiveEventKey` | Quantity-independent event identity (new) |
| `duplicateCluster` | Reconciliation groups feed existing clusters |
| `claimFingerprint` | Promotion gated on resolved reconciliation |
| `lineage` | `AGGREGATED_FROM` edges for parent/child |
| `monetizationLock` | One canonical event → one claim context |

---

## 3. Event identity (`ProductiveEventKey`)

`productive-event-key.ts` derives domain-aware event keys from:

- productive asset (`canonicalEntityId`)
- event type (`economicAction`)
- metric and unit
- time interval (`validFromUtc` / `validUntilUtc`)
- geography commitment
- batch/run/job identifier
- source-independent event identifier
- resource/output type
- aggregation level (`LEAF` | `COMPONENT` | `AGGREGATE`)

**Quantity is excluded** from the event key so corroborating observations with
tolerable variance share one identity. The reconciled quantity is bound when
deriving `canonicalEventId`.

### Domain boundary strategies

| Domain | Default strategy |
| --- | --- |
| ENERGY | `FIXED_INTERVAL` |
| COMPUTE | `BATCH_IDENTIFIER` |
| MANUFACTURING | `BATCH_IDENTIFIER` |
| AGRICULTURE | `FIXED_INTERVAL` |
| LOGISTICS | `SOURCE_EVENT_ID` |
| RESOURCES | `FIXED_INTERVAL` |
| WATER | `FIXED_INTERVAL` |

---

## 4. Temporal overlap

`temporal-overlap.ts` detects overlapping reporting windows using half-open
`[from, until)` intervals (aligned with Chunk 122 attribution windows):

| Relationship | Example |
| --- | --- |
| `CONTAINS` / `COMPONENT_OF` | Hourly record inside daily aggregate |
| `PARTIAL` | Overlapping but neither contains the other |
| `ADJACENT` | 06:00–07:00 then 07:00–08:00 |
| `EXACT` | Identical windows |

Hourly energy records plus daily aggregates must not be summed naïvely.

---

## 5. Overlap classes

`event-overlap.ts` classifies relationships between candidate events:

| Class | Meaning |
| --- | --- |
| `EXACT_DUPLICATE` | Same event key and quantity |
| `SAME_EVENT_CORROBORATION` | Same event, independent sources, tolerable variance |
| `PARTIAL_OVERLAP` | Partial temporal overlap with divergence |
| `AGGREGATE_OF` | Parent total of components |
| `COMPONENT_OF` | Child of an aggregate |
| `DISTINCT_EVENT` | No shared identity relationship |
| `UNRESOLVED` | Cannot determine — **not monetizable** |

Cross-provider matching uses canonical asset, time, metric, quantity tolerance,
location, event identifiers, and lineage. **Numeric similarity alone never
merges events.**

---

## 6. Parent/child reconciliation

Explicit aggregation relationships prevent double counting:

| Parent | Child | Relationship |
| --- | --- | --- |
| Factory total | Production line | `AGGREGATE_OF` / `COMPONENT_OF` |
| Datacenter total | Cluster | `AGGREGATE_OF` / `COMPONENT_OF` |
| Power plant total | Generation unit | `AGGREGATE_OF` / `COMPONENT_OF` |
| Farm total | Field | `AGGREGATE_OF` / `COMPONENT_OF` |

Lineage records `AGGREGATED_FROM` edges with transformation metadata.

---

## 7. Productive event reconciliation

`event-reconciliation.ts` produces auditable `ProductiveEventReconciliationResult`:

- candidate events and observations
- pairwise overlap assessments
- canonical event key and `canonicalEventId`
- quantity reconciliation (methodology, naive sum, reconciled quantity)
- confidence and manual review requirement
- source evidence references
- lineage record

### Anti-inflation quantity reconciliation

`reconcileQuantity` never sums corroborating sources:

- **Naive sum** = sum of all observation quantities (what inflation would produce)
- **Reconciled quantity** = single authoritative value (median when sources diverge within tolerance)
- `inflationPrevented` = true when naive sum exceeds reconciled quantity

### Hard-test guarantees

| Scenario | Naive sum | Reconciled |
| --- | --- | --- |
| 500 MWh × 5 sources | 2,500 MWh | 500 MWh |
| ERP 1,000 + logistics 995 + energy 1,010 | 3,005 units | 1,000 units (median) |
| 10,000 GPU-hours × 3 sources | 30,000 | 10,000 |

---

## 8. Claim creation gate

`claim-promotion.ts` enforces:

1. Only `RESOLVED` reconciliations may promote to `EconomicClaim`
2. `UNRESOLVED` clusters **must not** silently generate claims
3. `reconciledCanonicalEventId` binds the Wave 3 registry cluster
4. Duplicate claim fingerprints and cluster monetization locks are enforced

```typescript
canPromoteReconciliationToClaim(reconciliation) → boolean
promoteReconciliationToClaim(registry, reconciliation, input) → Result<EconomicClaim>
```

---

## 9. Monetization lock interaction

One canonical productive event maps to one claim monetization context:

- `assertMonetizationLockForReconciliation` verifies cluster state
- A second claim attempt for the same reconciled event returns `CLUSTER_ALREADY_MONETIZED`
- Different provider combinations cannot bypass the lock

---

## 10. Module map

| File | Responsibility |
| --- | --- |
| `productive-event-key.ts` | Domain-aware event identity |
| `productive-event-types.ts` | Wave 5 types |
| `temporal-overlap.ts` | Window overlap detection |
| `event-overlap.ts` | Overlap classification |
| `event-reconciliation.ts` | Reconciliation engine |
| `claim-promotion.ts` | Claim generation gate |
| `registry.ts` | Extended with `reconciledCanonicalEventId` |
| `fixtures/wave5-productive.ts` | Domain test fixtures |
| `wave5-productive-event-resolution.test.ts` | Adversarial test suite |

---

## 11. Validation

```bash
cd packages/sunrey-chain
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test src/economic-proof/wave5-productive-event-resolution.test.ts \
         src/economic-proof/economic-proof.test.ts
```

Tests cover energy, compute, manufacturing, agriculture, logistics, resources,
and water domains with aggregation overlap and source duplication scenarios.
