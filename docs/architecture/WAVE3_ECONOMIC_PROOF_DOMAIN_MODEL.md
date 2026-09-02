# Wave 3 Economic Proof Domain Model

**Version:** 1.0.0-wave3-prompt1  
**Status:** Simulation architecture (Wave 3 Prompt 1 foundation)  
**Owner:** `packages/sunrey-chain/src/economic-proof`  
**Companion:** `docs/architecture/WAVE3_ECONOMIC_CLAIMS_AND_DEDUPLICATION.md`, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

---

## Purpose

Wave 3 establishes the **canonical economic proof layer** that sits between
multi-source observations and monetary protocol events. It enforces:

```
MULTIPLE OBSERVATIONS ≠ MULTIPLE ECONOMIC EVENTS
```

and:

```
ONE ECONOMIC CLAIM MAY CROSS THE MONETARY BOUNDARY AT MOST ONCE
FOR THE SAME AUTHORIZED MONETIZATION CONTEXT
```

This document defines the Prompt 1 domain model. Prompt 2 implements
deduplication, clustering, lineage, monetization locking, and tests.

---

## Core types

### EconomicClaim

The central object promoted from corroborated observations. A claim is
**not** an observation, valuation, or issuance authorization.

| Field | Role |
| --- | --- |
| `claimId` | Stable record identifier |
| `economy` | `HUMAN` or `PRODUCTIVE` |
| `canonicalEntityId` | Pseudonymous / committed entity identity |
| `canonicalEventId` | Underlying economic event identity |
| `claimFingerprint` | Consensus-safe commitment over canonical claim fields |
| `duplicateClusterId` | Cluster grouping corroborating observations |
| `observationIds` | Supporting observation record IDs |
| `lineage` | Deterministic parent references and transformations |
| `monetizationLock` | One-time monetary boundary state |
| `challengeState` | Dispute / challenge posture |

### EconomicObservation

A single provider, sensor, or attestation record. Observations may
corroborate a claim; they do not mint.

| Field | Role |
| --- | --- |
| `observationId` | Stable observation record ID |
| `providerId` | Reporting source |
| `sourceClass` | Taxonomy class (meter, ERP, HIN, etc.) |
| `providerRecordId` | Provider-local record key |
| `observationFingerprint` | Exact/replay detection for this record |
| `payloadDigest` | Hash of normalized payload (no raw PII) |
| `observedAtUtc` | Observation timestamp |

### CanonicalEntityId

Deterministic identity for economic actors and assets **without** storing
raw personal data. Wave 4 expands external alias resolution; Wave 3
defines the interface boundary only.

### CanonicalEventId

Deterministic identity for the **underlying economic event**, independent
of how many observations report it. Derived from entity, action, quantity,
time window, and domain-specific committed identifiers — never from a
single provider record ID alone.

---

## Identity separation

| Concept | Detects | Does not detect |
| --- | --- | --- |
| `observationFingerprint` | Exact replay of same observation record | Independent corroboration |
| `canonicalEventId` | Same underlying event across sources | Exact byte replay at provider |
| `claimFingerprint` | Duplicate monetizable claim commitment | Observation-level replay |
| `duplicateClusterId` | Observations believed to describe one event | Automatic truth adjudication |

---

## Monetization boundary

Monetization means the claim has been **consumed as justification** for a
monetary protocol event (issuance proposal, settlement authorization
consumption, etc.). It is not market trading.

Statuses: `UNMONETIZED`, `PROPOSED`, `AUTHORIZED`, `CONSUMED`, `REJECTED`,
`REVOKED`, `CHALLENGED`.

A database flag alone is insufficient. Consumption requires a
`MonetizationConsumptionCommitment` binding `claimFingerprint`,
`monetizationContextId`, and an issuance/settlement replay key. The
canonical monetary system (`authorizeIssuance` replay IDs, settlement books)
remains the enforcement boundary.

---

## Economy paths

| Economy | Canonical owner (existing) | Wave 3 extension |
| --- | --- | --- |
| SunRey Human | `packages/human-economic-contribution` | Claim registry + cluster dedup |
| MoonRey Productive | `packages/sunrey-chain/src/productive` | Claim registry + cluster dedup |

Wave 3 does **not** replace contribution or productive registries. It
unifies anti-double-count at the claim layer above them.

---

## Non-goals (Wave 3)

- Full entity-resolution graph (Wave 4)
- External API integration (fixtures only)
- Production monetization activation
- Governance dispute adjudication (challenge model only)
