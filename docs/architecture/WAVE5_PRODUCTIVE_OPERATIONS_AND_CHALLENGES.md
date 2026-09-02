# Wave 5 — Productive Operations and Challenges

**Status:** Implemented (simulation)  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`  
**Owner:** `packages/sunrey-chain/src/productive/operations`

---

## Purpose

Productive economic truth is not static. Providers fail, lie, change schemas,
publish corrections, become compromised, lose licenses, and go stale.
Productive events can be challenged, corrected, superseded, and disputed.

Wave 5 makes the MoonRey productive intelligence stack capable of handling
mistakes, bad providers, corrections, and operational degradation **without
rewriting finalized blockchain history**.

Wave 5 builds on:

- Wave 3 economic proof and challenge architecture
- Wave 4 source reputation and durable observations
- Productive identities, events, Oracle Mesh, event resolution, GPUV, and
  proof-bound monetary proposals

---

## Challenge Architecture

Productive claim challenges extend Wave 3 / oracle dispute naming:

| Status | Meaning |
| --- | --- |
| `OPEN` | Challenge filed; future monetization may be blocked |
| `UNDER_REVIEW` | Human or governed review in progress |
| `UPHELD` | Challenge sustained; claim disputed |
| `REJECTED` | Challenge dismissed |
| `CORRECTED` | Corrected claim reference recorded |
| `SUPERSEDED` | Superseding claim reference recorded |

Implementation: `packages/sunrey-chain/src/productive/operations/challenge.ts`

Challenges block **future** monetization progression. They do not silently
reverse historical issuance.

---

## Post-Finality Semantics

When a claim supporting historical MoonRey issuance is later challenged:

1. **Historical blocks are NOT rewritten** (`historyRewritten: false`)
2. Subsequent challenge/correction state is recorded in
   `PostFinalityChallengeRecord`
3. Corrective monetary action requires explicit governance:
   - `GOVERNANCE_REVIEW`
   - `MULTI_PARTY_AUTHORIZATION`
   - `COMPENSATING_GOVERNED_TRANSACTION`
   - `PARAMETER_PACKAGE_AMENDMENT`
   - `MANUAL_COUNSEL_REVIEW` (when appropriate)
4. **Automatic clawback is forbidden** (`automaticClawback: false`)
5. **Silent burn is forbidden** (`silentBurn: false`)

User-held MoonRey is never burned automatically. Any corrective supply action
requires a governed transaction through Chunk 71 authority — not Wave 5
operations code.

---

## Source Reputation

`ProductiveSourceReputation` specializes Wave 4 reputation for productive
oracle providers.

Dimensions:

- data integrity history
- availability
- timeliness
- correction rate
- source independence
- schema stability
- observed disagreement
- verified incident history

**Reputation may influence review thresholds. Reputation does NOT establish
truth** (`establishesTruth: false`).

---

## Anomaly Controls

Anomaly detection produces **review signals only**:

| Signal | Trigger |
| --- | --- |
| `PRODUCTION_EXCEEDS_CAPACITY` | Output above configured capacity |
| `RETIRED_FACILITY_OUTPUT` | Inactive/superseded object reports output |
| `IMPOSSIBLE_GEOGRAPHIC_MOVEMENT` | Geography mismatch |
| `EXTREME_COMPUTE_OUTPUT` | Compute output far above capacity |
| `DUPLICATE_EVENT_FREQUENCY` | Repeated duplicate events |
| `WATER_OUTPUT_EXCEEDS_BOUNDS` | Water output above facility bounds |
| `MANUFACTURING_EXCEEDS_THROUGHPUT` | Manufacturing above throughput |

Anomalies never constitute automatic monetary judgment
(`automaticMonetaryJudgment: false`).

---

## Provider Incidents

Incident classifications:

- `PROVIDER_OUTAGE`
- `AUTH_FAILURE`
- `SCHEMA_BREAK`
- `DATA_INTEGRITY_FAILURE`
- `SOURCE_COMPROMISE_SUSPECTED`
- `LICENSE_CHANGE`
- `EXTREME_OUTLIER`
- `SYSTEMATIC_BIAS_SUSPECTED`

Containment actions (scoped, not global):

- `DISABLE_PROVIDER`
- `QUARANTINE_DATA`
- `STOP_DOMAIN_VERIFICATION`
- `REQUIRE_MANUAL_REVIEW`

**One provider failure does not pause the entire blockchain**
(`blockchainPaused: false`).

---

## Domain Circuit Breakers

Per-domain fail-closed controls pause productive verification for a single
category when independent source coverage falls below threshold.

Example: if energy verification loses required independent source coverage,
`ENERGY` verification may pause while `COMPUTE`, `MANUFACTURING`, and
`WATER` continue. Ordinary blockchain transfers remain independent
(`transfersPaused: false`).

---

## AI Role

| Allowed | Forbidden |
| --- | --- |
| Identify anomalies | Declare disputed fact valid |
| Compare observations | Override source quorum |
| Explain conflicts | Override rights |
| Suggest source dependencies | Approve issuance |
| Summarize challenge evidence | Modify supply |

---

## Observability

`ProductiveOperationsMetrics` tracks aggregate operational signals:

- observations by domain
- independent sources per claim
- verification pass/fail
- conflict rate / duplicate rate
- event-resolution rate
- GPUV calculations
- productive claims created / challenged
- MoonRey proposals / rejections
- provider outages
- source dependence warnings

No sensitive raw data is included in metrics.

---

## Audit Views

`ProductiveOperationsAuditView` provides read-only operational surfaces:

- Which providers support energy verification?
- Which source classes are degraded?
- Which productive claims are challenged?
- Which MoonRey proposals are blocked and why?
- Which productive assets have anomaly flags?

---

## Module Layout

```
packages/sunrey-chain/src/productive/operations/
  types.ts
  challenge.ts
  post-finality.ts
  source-reputation.ts
  anomalies.ts
  ai-role.ts
  incidents.ts
  circuit-breaker.ts
  metrics.ts
  audit.ts
  platform.ts
  fixtures.ts
  index.ts
```

Tests: `tests/wave-5-productive-operations.test.ts`

Runbook: `docs/runbooks/MOONREY_PRODUCTIVE_DATA_INCIDENT_RESPONSE.md`

---

## Invariants

- No history rewrite on post-finality challenge
- No automatic clawback or silent burn
- Anomalies are review signals, not monetary judgments
- Reputation does not establish truth
- AI cannot override hard rules
- Domain circuit breakers are scoped per productive category
- Ordinary MoonRey transfers remain independent from productive-data outages
- Wave 5 does not mint, post journals, or issue Execution Authority

---

## Related Documents

- [`WAVE3_ECONOMIC_PROOF_DOMAIN_MODEL.md`](./WAVE3_ECONOMIC_PROOF_DOMAIN_MODEL.md)
- [`WAVE3_PROOF_BOUND_MONETARY_TRANSITIONS.md`](./WAVE3_PROOF_BOUND_MONETARY_TRANSITIONS.md)
- [`SUNREY_ECONOMIC_PROOF_CAPABILITY_MATRIX.md`](./SUNREY_ECONOMIC_PROOF_CAPABILITY_MATRIX.md)
- [`../runbooks/MOONREY_PRODUCTIVE_DATA_INCIDENT_RESPONSE.md`](../runbooks/MOONREY_PRODUCTIVE_DATA_INCIDENT_RESPONSE.md)
