# Wave 4 — Information Consensus

**Status:** Simulation / engineering implementation  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags remain `false`  
**Authority:** Zero monetary authority; zero Execution Authority

Information Consensus is the first formal evaluation boundary of the Economic Awareness Fabric. It answers one question only:

> Do we have sufficient authorized evidence to treat a real-world economic proposition as verified information?

It does **not** answer whether a blockchain transition, issuance event, or ledger journal is authorized. That is **Monetary Consensus**, evaluated later through the Compliance Kernel and Chunk 71 monetary constitution.

---

## Information vs Monetary Consensus

| Plane | Question | May mint? | Canonical owner |
| --- | --- | --- | --- |
| **Information Consensus** | Is this economic fact sufficiently evidenced? | **No** | `packages/sunrey-chain/src/economic-awareness-fabric/information-consensus` |
| **Monetary Consensus** | Given verified fact + valid authorization, is this transition valid? | Only via Kernel → Execution Authority | `packages/kernel`, `packages/sunrey-chain/src/economics` |

Never merge these questions. A `VERIFIED` Information Consensus result produces an `InformationVerifiedEconomicFact` with `grantsMonetaryAuthority: false`. Downstream Wave 5 oracle mesh or Wave 6 human settlement paths consume that fact; they do not inherit mint authority from it.

```text
Normalized observations + lineage + provenance
        |
        v
Information Consensus (this document)
        |
        +--> InformationConsensusReceipt (auditable)
        |
        +--> InformationVerifiedEconomicFact (zero monetary authority)
        |
        v
Wave 5/6 claim and monetary paths (separate gates)
```

---

## Evaluation boundary

### Input

The versioned evaluator accepts:

- candidate fact/claim (`CandidateEconomicProposition`)
- supporting observations (`NormalizedEconomicObservation[]`)
- source identities and source classes
- provider lineage (`ProviderLineage`)
- provenance references
- freshness, confidence, rights status, integrity
- entity resolution binding
- contradictions
- methodology/policy reference (`MethodologyReference`)

### Output results

| Result | Meaning |
| --- | --- |
| `VERIFIED` | Sufficient independent evidence under configured methodology |
| `INSUFFICIENT_EVIDENCE` | Corroboration quorum or required evidence not met |
| `DISPUTED` | Material conflict without manual-review path |
| `STALE` | Supporting observation outside freshness policy |
| `INVALID` | Integrity failure or forbidden unverified provider |
| `RIGHTS_RESTRICTED` | Rights/consent boundary blocks use |
| `SOURCE_DEPENDENCY_FAILURE` | Required upstream lineage unavailable |
| `MANUAL_REVIEW_REQUIRED` | Policy-triggered human review (e.g. material conflict) |

Every outcome seals an `InformationConsensusReceipt` with explanation codes. No outcome grants Execution Authority.

---

## Source independence

Three providers copying the same upstream source (e.g. EIA → aggregator A → aggregator B → aggregator C) count as **one** independent lineage root, not three confirmations.

Independence analysis uses:

- `lineageRootId`
- `upstreamOrganizationId`
- `controllerId`
- `sharedControlGroup`

`endpointCountIsNotIndependence` is always true: more HTTP endpoints does not mean more independent evidence.

Implementation: `independence.ts`

---

## Corroboration

Corroboration rules are **versioned per methodology**, not hard-coded as universal "2 of 3".

Example productive energy methodology (`productive-energy-information-consensus@1.0.0`):

- requires independent classes among `DIRECT_SENSOR`, `PRIMARY_OPERATOR`, `GOVERNMENT_REFERENCE`
- minimum independent lineage roots configurable per rule

Human methodology accepts attestations, credentials, receipts, research references, employment verification, computation receipts, and authorized data proofs.

Implementation: `methodology.ts`, `corroboration.ts`

---

## Source reputation

`SourceReputation` measures operational trustworthiness:

- historical availability
- schema stability
- integrity history
- correction frequency
- known upstream lineage
- verification performance
- timeliness
- dispute history

Reputation is **explainable and versioned** (`sunrey.source-reputation.v1`). It is not truth, not popularity, and cannot be set arbitrarily by AI.

High reputation contradicted by direct measurement triggers `MANUAL_REVIEW_REQUIRED`, not automatic acceptance of the high-reputation source.

Implementation: `reputation.ts`

---

## Conflict detection

Numeric conflicts compare observations using per-domain tolerance policy:

- relative tolerance (e.g. 2% for productive energy)
- absolute tolerance (e.g. 5 MWh)
- outlier z-score threshold

Example: 500 MWh, 495 MWh, 900 MWh → 500/495 within tolerance; 900 flagged as material conflict and outlier. The engine does **not** average all values blindly.

Implementation: `conflicts.ts`

---

## Freshness

Freshness is policy-driven by domain and fact pattern:

| Domain | Example window |
| --- | --- |
| Productive grid output | 1 hour |
| Human contribution attestation | ~1 year |
| Annual government statistic | ~366 days |

Stale observations are listed in the receipt and cannot silently support a current fact.

Implementation: `freshness.ts`

---

## Verified economic fact

Only `VERIFIED` Information Consensus creates an `InformationVerifiedEconomicFact`:

- schema: `sunrey.information-verified-fact.v1`
- binds receipt ID, methodology version, source observation IDs, independent lineage roots
- `grantsMonetaryAuthority: false`
- `grantsExecutionAuthority: false`

Optional adapter `toOracleVerifiedEconomicFactCandidate()` prepares Wave 5 oracle integration without activating production oracle mesh or mint paths.

Implementation: `verified-fact.ts`

---

## Human vs Productive differences

| Aspect | Human (`HUMAN`) | Productive (`PRODUCTIVE`) |
| --- | --- | --- |
| Primary evidence | Attestations, credentials, receipts, authorized proofs | Sensors, operators, government, satellite, enterprise systems |
| Oracle logic | Productive oracle rules **not** applied blindly | Source-class quorum required |
| Wave scope | Extensibility only; full intelligence deferred to Wave 6 | Wave 5 oracle mesh preparation only |

Implementation: `human-safety.ts`, `productive-safety.ts`

---

## AI boundary

AI may assist with:

- anomaly detection hints
- entity matching suggestions
- conflict explanation
- source comparison

AI must **not**:

- declare monetary truth
- approve issuance
- override failed rights checks
- override hard verification requirements
- fabricate missing observations

AI assistance is recorded as `AI_ASSISTANCE_ONLY` and never changes deterministic policy outcomes.

Implementation: `ai-boundary.ts`

---

## Receipt and Wave 3 integration

`InformationConsensusReceipt` contains:

- `evaluationId`
- candidate proposition
- observations evaluated
- independent source classes
- provider lineage
- corroboration result
- conflict and freshness assessments
- rights and reputation summaries
- methodology version
- result and explanation codes
- timestamps

Receipts are designed to feed Wave 3 Evidence/Claim architecture as non-authoritative, auditable information-plane artifacts.

Implementation: `receipt.ts`, `engine.ts`

---

## Canonical module layout

```text
packages/sunrey-chain/src/economic-awareness-fabric/
  types.ts
  information-consensus/
    types.ts
    methodology.ts
    independence.ts
    corroboration.ts
    reputation.ts
    conflicts.ts
    freshness.ts
    receipt.ts
    verified-fact.ts
    human-safety.ts
    productive-safety.ts
    ai-boundary.ts
    engine.ts
    fixtures.ts
    information-consensus.test.ts
```

---

## Invariants

1. Information Consensus never creates money.
2. Information Consensus never issues Execution Authority.
3. Shared upstream lineage never inflates independent corroboration count.
4. Stale evidence never silently verifies a current fact.
5. Rights restrictions fail closed.
6. AI is advisory only.
7. Monetary authorization remains exclusively downstream of the Compliance Kernel.
