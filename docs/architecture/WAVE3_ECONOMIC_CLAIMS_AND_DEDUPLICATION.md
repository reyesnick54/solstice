# Wave 3 Economic Claims and Deduplication

**Version:** 1.0.0-wave3-prompt2  
**Status:** Simulation implementation  
**Owner:** `packages/sunrey-chain/src/economic-proof`  
**Companion:** `docs/architecture/WAVE3_ECONOMIC_PROOF_DOMAIN_MODEL.md`, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

---

## 1. Problem statement

SunRey and MoonRey must not monetize the same underlying economic event more
than once merely because that event appears through:

- multiple APIs
- multiple providers
- multiple databases
- slightly different identifiers
- retries
- multiple attestations
- multiple publications
- multiple sensors
- multiple observers

**Core invariant:**

```
MULTIPLE OBSERVATIONS ≠ MULTIPLE ECONOMIC EVENTS
```

**Monetization invariant:**

```
ONE ECONOMIC CLAIM MAY CROSS THE MONETARY BOUNDARY AT MOST ONCE
FOR THE SAME AUTHORIZED MONETIZATION CONTEXT
```

---

## 2. Pre-Wave 3 audit (Task 1)

See `packages/sunrey-chain/src/economic-proof/audit.ts` for the machine-readable
audit. Summary of weaknesses:

### SunRey Human Economy

| Surface | Protection | Weakness |
| --- | --- | --- |
| `HumanContributionRegistry` fingerprint | `DUPLICATE_FINGERPRINT` | No cross-source alias resolution |
| `HinContributionAdapter` | `DUPLICATE_USAGE_RECEIPT` | Receipt-scoped only |
| `HinEconomicValueEngine` | `hinReplayKey` | Path-specific replay key |
| `HumanContributionMonetaryBridge` | `settledReplayKeys`, contribution ids | In-memory; fingerprint may differ per path |
| Chain anchors | Source-key dedup | Anchoring ≠ monetization dedup |

### MoonRey Productive Economy

| Surface | Protection | Weakness |
| --- | --- | --- |
| `contributionFingerprint` V1/V2 | Productive submit dedup | Oracle fact id variance across providers |
| Attribution accounting fingerprints | Stripped replay keys | Not unified with human path |
| `ProductiveSettlementBook` | settled sets + replayKeyOf | Summation risk without cluster enforcement |
| Oracle observations | Per-provider record id | No canonical event clustering |

### Shared

| Surface | Protection | Weakness |
| --- | --- | --- |
| `authorizeIssuance.usedReplayIds` | Issuance replay | Does not dedupe upstream claims |
| Provider job/receipt ids | Per-provider | Retries create new ids |

Wave 3 adds the **claim layer** above these paths without weakening them.

---

## 3. Event identity

`canonicalEventId` is derived in `event-identity.ts` from:

- `canonicalEntityId`
- `economicAction`
- `quantity` (bigint string)
- `unit`
- `validFromUtc` / `validUntilUtc`
- optional `locationCommitment`
- optional `domainIdentifierCommitment`

It **never** uses a single provider's `providerRecordId`.

Independent observations of the same event (e.g. meter + grid operator +
government dataset + weather estimate for 500 MWh) share one
`canonicalEventId` when their committed event material matches.

---

## 4. Entity identity

`canonicalEntityId` is derived in `entity-identity.ts` from:

- `economy` (`HUMAN` | `PRODUCTIVE`)
- `entityKind` (person, factory, power plant, etc.)
- `entityCommitment` (pseudonymous / hashed commitment — no raw PII)
- optional `jurisdiction`

### Alias mapping boundary (Wave 4 expansion)

```typescript
type EntityAliasResolver = {
  resolveAlias(alias: EntityAliasRef): CanonicalEntityId | null;
};
```

Wave 3 provides the interface and fixture resolver only. Full external
entity-resolution is deferred to Wave 4.

**Human example:** PubMed, university, ORCID, and HIN aliases resolve to
one canonical researcher commitment in fixtures (`fixtures/human.ts`).

---

## 5. Observation fingerprint

`observationFingerprint` (`observation-fingerprint.ts`) detects **exact
replays** of the same provider record:

```
providerId + sourceClass + providerRecordId + payloadDigest + observedAtUtc
```

| Case | Result |
| --- | --- |
| Same provider record resubmitted | `OBSERVATION_REPLAY` |
| Independent meter + grid operator | Different fingerprints, same `canonicalEventId` |
| Corroboration | Strengthens cluster; does not create new claim |

---

## 6. Claim fingerprint

`claimFingerprint` (`claim-fingerprint.ts`) commits consensus-safe claim
fields:

```
economy + canonicalEntityId + canonicalEventId + economicAction
+ quantity + unit + time window + jurisdiction/category commitments
```

Privacy-sensitive human claims use `entityCommitment` and
`jurisdictionCommitment` — never raw identity values.

Duplicate claim registration returns `CLAIM_ALREADY_EXISTS`.

---

## 7. Lineage

`lineage.ts` implements an acyclic DAG:

- `OBSERVED_FROM` — observation → claim
- `ATTESTED_BY`, `TRANSFORMED_FROM`, `AGGREGATED_FROM`, `NORMALIZED_FROM`,
  `DERIVED_FROM`, `PRODUCED`

Each edge records optional `methodologyVersion` and `transformation`.
`wouldCreateLineageCycle` rejects circular references.

---

## 8. Duplicate clustering

`duplicateClusterId = hash(canonicalEventId)`

A cluster groups observations believed to describe one economic event:

```
EconomicClaim
  ├── Observation A (meter)
  ├── Observation B (grid operator)
  ├── Observation C (government dataset)
  └── Observation D (weather estimate)
```

Tracked fields:

- `observationIds`
- `sourceClasses`
- `resolutionStatus` (`SINGLE_OBSERVATION`, `CORROBORATING`, etc.)
- `confidence` (`LOW` | `MEDIUM` | `HIGH`)
- `claimId` (at most one monetizable claim per cluster)

**Summation guard:** `totalClusterQuantity` returns the single claim
quantity, not the sum of observation quantities.

---

## 9. Monetization lock

Statuses: `UNMONETIZED`, `PROPOSED`, `AUTHORIZED`, `CONSUMED`, `REJECTED`,
`REVOKED`, `CHALLENGED`.

Monetization means the claim was **consumed as justification** for a
monetary protocol event — not market trading.

### Consumption commitment

A database flag alone is insufficient. Consumption requires:

```typescript
deriveConsumptionCommitment({
  claimFingerprint,
  contextId,
  replayKey,
})
```

The registry records commitments in `#consumptionCommitments`. Replay
returns `ALREADY_CONSUMED`. This composes with Chunk 71 `usedReplayIds`
and settlement book `replayKeyOf` patterns at the monetary boundary.

---

## 10. Challenge state

| Status | Monetization progression |
| --- | --- |
| `NONE` | Allowed (subject to lock state) |
| `OPEN` | Blocked by default |
| `MATERIAL_DISPUTE` | Blocked by default |
| `RESOLVED_UPHELD` | Blocked |
| `RESOLVED_INVALIDATED` | Allowed |

`DEFAULT_MONETIZATION_POLICY.allowProgressionUnderChallenge = false`.

Full governance adjudication is out of scope for Wave 3.

---

## 11. Human Economy examples

### Research contribution (four sources → one claim)

Fixtures in `fixtures/human.ts`:

1. PubMed publication record
2. University repository record
3. ORCID identity source
4. HIN subject record

All observations share `canonicalEventId`. One `EconomicClaim` registers.
A second claim attempt returns `CLAIM_ALREADY_EXISTS`.

### Employment replay

Same employer timesheet resubmitted → `OBSERVATION_REPLAY`.

### Computation receipt replay

Same GPU job receipt → `OBSERVATION_REPLAY`.

### Attestation replay

Same attestation id → `OBSERVATION_REPLAY`.

---

## 12. Productive Economy examples

### 500 MWh energy event (four observers)

Meter, grid operator, government dataset, weather-derived estimate:

- Four observations, one `canonicalEventId`
- One claim for `500_000_000` watt_hours (fixture scale)
- **Not** 2,000 MWh from summation

### Factory production

ERP + logistics + energy meter observations cluster into one
`GOODS_PRODUCED` claim.

### Compute workload

Datacenter telemetry + workload receipt → one `COMPUTE_WORKLOAD` claim.

---

## 13. Threat model

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Double monetization via API retry | `observationFingerprint` + `consumptionCommitment` | Cross-node durability (Wave 2+ consensus) |
| Same event, different provider ids | `canonicalEventId` + cluster | Incorrect event material → false split (Wave 4 resolution) |
| Relabel attack (category/object rename) | Claim fingerprint uses canonical ids, not provider labels | Sophisticated material mis-commitment |
| Summation of corroborating sources | One claim per cluster | Manual duplicate clusters if event material differs |
| Silent monetization under dispute | Challenge blocks progression | Policy override if misconfigured |
| Raw PII in claim identity | `entityCommitment` only | Upstream must hash before Wave 3 |
| Database-only monetization flag | Consumption commitment registry | Must wire to chain replay on production |
| AI/oracle direct mint | Out of scope — blocked at Chunk 71 | N/A |

---

## 14. Remaining gaps (Wave 4+)

- Full external entity-resolution graph
- Durable PostgreSQL claim registry
- Consensus-level consumption enforcement on sovereign blocks
- Automated cluster merge when event material is close but not identical
- Governance dispute adjudication workflow
- Live provider API integration

---

## 15. Implementation map

| Module | Responsibility |
| --- | --- |
| `entity-identity.ts` | `canonicalEntityId`, alias boundary |
| `event-identity.ts` | `canonicalEventId` |
| `observation-fingerprint.ts` | Exact replay detection |
| `claim-fingerprint.ts` | Monetization-safe claim commitment |
| `duplicate-cluster.ts` | Cluster model |
| `lineage.ts` | Acyclic lineage DAG |
| `monetization-lock.ts` | Lock states + consumption commitment |
| `registry.ts` | `EconomicClaimRegistry` orchestration |
| `audit.ts` | Pre-Wave 3 weakness documentation |
| `fixtures/` | Human and productive scenario fixtures |
| `economic-proof.test.ts` | Wave 3 test scenarios |

---

## 16. Validation

```bash
# Wave 3 economic proof tests
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test --test-reporter=spec \
  packages/sunrey-chain/src/economic-proof/economic-proof.test.ts \
  tests/wave-3-economic-proof.test.ts

# Wave 2 regression (external data + completion)
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test --test-reporter=spec \
  tests/wave-2-completion.test.ts \
  tests/wave-2-prompt-8-macro-providers.test.ts \
  packages/external-data/src/wave2.test.ts
```
