# Wave 6 — PEVE and Human Economic Valuation

**Status:** Simulation-only engineering reference  
**Owner:** `packages/human-economic-contribution/src/peve/`  
**Constitution:** Chunk 110–111 human contribution valuation (extended)

---

## Purpose

Wave 6 formalizes a clean, auditable transition from verified human economic contribution to a versioned valuation result — without conflating person, contribution, PEVE, SunRey quantity, or market price.

```
Human Contribution Event
        │
        ▼
   Verification (+ attestations, rights, consent, uniqueness)
        │
        ▼
 VerifiedHumanEconomicContributionInput
        │
        ▼
 Human Economic Value Engine (PEVE)
   + versioned methodology
        │
        ▼
 HumanEconomicValuationResult
        │
        ▼
 HumanEconomicValuationReceipt
        │
        ▼
 Monetary Policy / Settlement Bridge (separate, gated)
```

---

## Separation invariants

| Concept | What it is | What it is NOT |
|---------|------------|----------------|
| **Person** | Pseudonymous subject reference | A scored “human worth” |
| **Contribution** | One verified economic event | A person-level ranking |
| **PEVE result** | Versioned reference value for one contribution | SunRey quantity, mint authority, or exchange price |
| **SunRey quantity** | Governed monetary issuance (Chunk 71) | Automatic output of PEVE |
| **SunRey price** | Exchange market outcome | PEVE input or formula |

Explicit boundary flags (always `false`):

- `humanWorthAssigned`
- `humanWorthScore`
- `peveScoreUsedAsValue`
- `peveUsedAsTokenFormula`
- `setsExchangePrice`
- `mintsSunRey`

---

## Distinct PEVE systems

SunRey has **two** PEVE-named systems that must not be conflated:

| System | Location | Question |
|--------|----------|----------|
| **Platform PEVE** | `packages/platform/src/value/` | How is this person's economic *system* performing? |
| **Human Economic Valuation (Wave 6 PEVE)** | `packages/human-economic-contribution/src/peve/` | What reference value applies to *this verified contribution* under *this methodology*? |

Chunk 111 `HumanContributionValuationEngine` performs the deterministic valuation math. Wave 6 `HumanEconomicValueEngine` adds claim binding, methodology versioning, receipt generation, and market/AI/human-worth firewalls.

---

## Verified contribution input

`VerifiedHumanEconomicContributionInput` binds:

| Field | Role |
|-------|------|
| `contribution` | Canonical verified human contribution event |
| `humanEconomicClaimId` | Human Economic Claim reference |
| `canonicalEventId` | Canonical event identifier |
| `verificationReceiptRef` | Verification receipt |
| `identityAssuranceLevel` | Identity assurance (must be above `UNVERIFIED`) |
| `evidenceProofRefs` | Evidence commitments |
| `rightsProofRefs` | Rights proof |
| `consentProofRefs` | Consent proof |
| `policyProofRefs` | Policy proof |
| `contributionClass` | Contribution taxonomy class |
| `authorizedScope` | Authorized valuation scope |
| `uniquenessStatus` | Must be `UNIQUE` |
| `methodologyId` / `methodologyVersion` | Versioned methodology |

No raw personal dataset is required or accepted.

---

## Methodology versioning

Contribution-specific methodology interfaces live in `peve/methodologies.ts`. Each defines schema and governance references only — **production formulas are not approved**.

| Domain | Simulation methodology | Example classes |
|--------|---------------------|-----------------|
| Research | `RESEARCH_METHODOLOGY_V1` | `RESEARCH_PARTICIPATION`, `VERIFIED_KNOWLEDGE_CONTRIBUTION` |
| Work | `WORK_METHODOLOGY_V1` | `PROFESSIONAL_EXPERTISE`, `HUMAN_SERVICE_DELIVERY`, … |
| Education | `EDUCATION_METHODOLOGY_V1` | `EDUCATION_SKILL_ATTESTATION` |
| Computation | `COMPUTATION_METHODOLOGY_V1` | `MODEL_TRAINING_PARTICIPATION`, `ECONOMIC_PARTICIPATION` |
| Authorized data use | `AUTHORIZED_DATA_USE_METHODOLOGY_V1` | `INFORMATION_RIGHT_CONTRIBUTION`, … |

`approvalStatus` is `SIMULATION_ONLY` for all current methodologies. Inputs marked `policyReviewRequiredInputs` need later legal/policy review before any production activation.

---

## Determinism

For the same:

- verified contribution fingerprint,
- methodology id/version,
- valuation policy version,
- reference data snapshot, and
- valuation timestamp,

the engine produces the same `valuationDigest` and `resultCommitment`.

Forbidden non-deterministic inputs:

- current web lookup
- current Exchange price
- random AI response
- floating-point monetary math
- timezone-dependent implicit “now” inside the valuation formula

---

## AI boundary

AI may assist:

- classification
- explanation
- anomaly detection
- evidence summarization

AI may **not**:

- directly set canonical PEVE monetary input
- authorize valuation, settlement, or minting
- enter blockchain consensus as valuation authority

See `peve/ai-boundary.ts` and Chunk 111 `AI_VALUATION_BOUNDARY`.

---

## Market separation

Proven in `peve/market-separation.ts`:

1. **SunRey Exchange price does not determine PEVE** — `exchangePrice*` fields are rejected as inputs.
2. **PEVE does not automatically determine SunRey Exchange price** — `setsExchangePrice: false` on every result.
3. **Market capitalization does not determine human contribution value** — `marketCap*` inputs rejected.
4. **MoonRey GPUV cannot substitute for PEVE** — productive GPUV is a separate productive-economy construct.

---

## Valuation receipt

`HumanEconomicValuationReceipt` includes:

- `valuationId`
- `subjectPseudonymRef`
- `contributionId`
- `humanEconomicClaimId`
- `contributionClass`
- `methodologyId` / `methodologyVersion`
- `authorizedInputsDigest`
- `verificationReceiptRef` / `verificationReferences`
- `valuationResult` (bigint reference value, not SunRey)
- `policyReference`
- `resultCommitment` (cryptographic commitment)
- `environmentStatus` (`SIMULATION`)

---

## Monetary policy handoff

PEVE output is **not** mint authority. Downstream monetary policy consumes:

1. `HumanEconomicValuationReceipt` (reference value + commitments)
2. Separate conversion policy (Chunk 108/112 bridge)
3. Explicit settlement authorization

The human contribution monetary bridge (`packages/sunrey-chain/src/economics/human-contribution-bridge/`) remains the gated path to SunRey quantity. `PEVE_USED_AS_TOKEN_FORMULA` stays `false`.

---

## Related audit surfaces

| Area | Location |
|------|----------|
| Chunk 110 constitution | `valuation/constitution.ts` |
| Chunk 111 engine | `valuation/engine.ts` |
| Platform PEVE (person system) | `packages/platform/src/value/` |
| Monetary bridge | `sunrey-chain/.../human-contribution-bridge/` |
| Production candidate policies | `valuation/production-candidate/` |
| Wave 6 tests | `tests/wave6-peve-human-economic-valuation.test.ts` |

---

## Remaining simulation methodologies

All Wave 6 methodologies are `SIMULATION_ONLY` with `formulaApproved: false`. Production activation requires:

1. Governed production valuation policy (Chunk 110 — not configured)
2. Production conversion policy (Chunk 108 — `UNCONFIGURED`)
3. Legal/commercial review of `policyReviewRequiredInputs`
4. Explicit production activation ceremony (Chunks 143–165 — not activated)

Do not flip `PRODUCTION_PEVE_ACTIVATED` or `PRODUCTION_VALUATION_ACTIVATION` without governed authorization.
