# Wave 6 — SunRey Human Economy Monetary Pipeline and Operations

**Program:** SunRey Sovereign Architecture — Wave 6 (SunRey Human Economic Intelligence)  
**Date:** 2026-09-02  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`  
**Owner:** `packages/sunrey-chain/src/economics/human-economy/` (extends Wave 3 proof-bound and Chunk 108 bridge)

---

## 1. Purpose

Wave 6 connects verified human economic contribution to governed SunRey issuance without creating a second monetary pipeline. No earlier component may directly mint.

**Governed pathway:**

```
Human Activity
  → Attestation Mesh (upstream; Wave 6 intelligence fabric)
  → Human Information Consensus (Wave 4)
  → Canonical Human Contribution (Human Contribution Registry)
  → Economic Claim (Wave 3 CanonicalEconomicClaim)
  → Evidence Proof / Rights Proof / Policy Proof (Wave 3)
  → PEVE / Human Economic Valuation (reference only)
  → Monetary Policy (explicit boundary)
  → SunRey Monetary Proposal
  → Governance
  → Protocol ISSUE Transaction (Wave 3 executeProofBoundSunReyIssuance)
  → Validator Consensus (Wave 2 deterministic state)
  → Finalized SunRey State
```

---

## 2. Audit — Current SunRey Issuance Paths

| Path | Location | Mint? | Wave 6 role |
| --- | --- | --- | --- |
| **A — Chunk 108 bridge** | `human-contribution-bridge/gate.ts` | Via `authorizeIssuance` | Upstream settlement authorization |
| **B — Phase G pipeline** | `native-assets/issuance-pipelines.ts` | Via `authorizeIssuance` | Simplified simulation flags |
| **C — Wave 3 proof-bound** | `economics/proof-bound/pipeline.ts` | Via `authorizeIssuance` | **Canonical ISSUE gate reused by Wave 6** |
| **D — HIN basis proposal** | `hin-value/issuance-basis.ts` | **No** | Economic input only |
| **E — HIN → registry** | `information-market/.../adapter.ts` | **No** | Contribution registration |
| **F — `packages/sunrey-coin`** | Parallel ledger simulation | Kernel EA, not AssetSupplyBook | **Not canonical**; documented duplicate |
| **G — Consumer BFF** | `services/api/src/consumer/` | **No** | Read-only |

Wave 6 adds orchestration at `human-economy/pipeline.ts` that formalizes proposals, enforces PEVE/monetary-policy separation, governance, challenges, circuit breakers, and monitoring — then delegates mint to Wave 3.

---

## 3. SunRey Issuance Proposal

Schema: `sunrey.human-economy.issuance-proposal.v1`

Required references:

- Human Economic Claim (`economicClaimId`)
- Canonical contribution event
- Pseudonymous actor commitment (no raw personal data)
- Verification receipt
- Evidence / Rights / Policy proof refs
- PEVE valuation (reference value, digest)
- Monetary policy reference
- Proposed SunRey quantity (governed derivation)
- Governance requirements
- Monetization key
- Schema version

**Invariant:** `quantityDerivedFromPeve: false` — PEVE result must not automatically equal SunRey quantity.

---

## 4. PEVE / Monetary Policy Boundary

| Stage | Owner | Output |
| --- | --- | --- |
| PEVE | `packages/human-economic-contribution/src/valuation/` | Reference settlement value |
| Monetary Policy | `human-economy/monetary-policy.ts` | Proposed SunRey quantity |
| Mint | Wave 3 `executeProofBoundSunReyIssuance` | Supply mutation |

Simulation uses `simulationConversionPolicy()` (numerator 2, denominator 5): 500 reference units → 200 SunRey.

Production issuance formula: **`PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED = false`**. MAINNET derivation refuses with `PRODUCTION_SUNREY_ISSUANCE_FORMULA_NOT_APPROVED`.

---

## 5. Governance

Only `HUMAN_GOVERNANCE` or `PROTOCOL` with valid authorization may approve issuance proposals.

**Explicitly rejected as independent monetary authorities:**

- AI, PEVE, HIN, ContributionVerifier, ConsentService, IdentityService, Exchange, database, API, validator, Agent, Financial Agent, S3M, Grok, Model

Implementation: `human-economy/governance.ts`

---

## 6. One-Time Claim Consumption

Reuses Wave 3 canonical claim consumption:

- `ClaimRegistry.monetizedClaimIds`
- `ConsumptionStore.consumedKeys` / `consumedAuthorizations`
- Durable persistence via `persistConsumptionStore` / `loadConsumptionStore` / `replayConsumptionLog`

The same Human Economic Claim cannot issue SunRey twice through new wallet, account, evidence bundle, attestation, proposal, API request, restart, snapshot restore, or different validator replay.

---

## 7. SunRey Economic Receipt

Schema: `sunrey.human-economy.economic-receipt.v1`

Read-only artifact answering **WHY DID THIS SUNREY ENTER CIRCULATION?**

Includes: finalized transaction, SunRey quantity, claim, contribution event, pseudonymous actor, verification receipt, Evidence/Rights/Policy roots and proof hashes, PEVE valuation, monetary policy, governance authorization, finalized block, Monetary State Root.

Never exposes unnecessary raw personal data (`containsRawPersonalData: false`).

---

## 8. Human Claim Challenges

Challenge reasons: attestation revoked, credential fraud, identity compromise, duplicate contribution, source correction, rights dispute.

Lifecycle: `FILED` → `UNDER_REVIEW` → `UPHELD` | `REJECTED` | `CORRECTION_RECORDED`

Does not rewrite finalized blockchain history.

---

## 9. Post-Finality Correction

Append-only correction records bind challenges to related transactions.

- `automaticSeizureForbidden: true`
- `automaticBurnForbidden: true`
- `requiresGovernedMonetaryPolicy: true`

Any corrective monetary mechanism requires explicit governed monetary policy.

---

## 10. Contribution Verifier Reputation

Risk signals (not truth): verification accuracy, signature integrity, revocation frequency, dispute rate, issuer status, source independence, historical reliability.

Used for monitoring and circuit-breaker decisions only. Never automatic issuance authority.

---

## 11. Domain Circuit Breakers

Per contribution domain (`RESEARCH`, `WORK`, `EDUCATION`, `COMPUTATION`):

- Pause new automated verification when provider compromised
- Does **not** halt ordinary SunRey transfers, MoonRey, unrelated categories, or the whole blockchain

---

## 12. Monitoring

Counters in `human-economy/monitoring.ts`:

contributions submitted/verified/rejected, manual review, duplicate, identity conflicts, Sybil signals, consent denials, rights denials, PEVE calculations, SunRey proposals/rejections, challenged claims, attestation-provider health alerts.

No sensitive raw personal information in metrics.

---

## 13. Tests

| Suite | Path |
| --- | --- |
| Wave 6 human economy monetary | `tests/wave6-sunrey-human-economy-monetary.test.ts` |
| Wave 3 proof-bound (reused) | `packages/sunrey-chain/src/economics/proof-bound/proof-bound.test.ts` |
| Chunk 108 bridge | `packages/sunrey-chain/src/economics/human-contribution-bridge.test.ts` |

---

## 14. Production Activation Status

| Control | Status |
| --- | --- |
| `PRODUCTION_SUNREY_ISSUANCE_FORMULA_APPROVED` | **false** |
| `PRODUCTION_ACTIVATED` (Chunk 108) | **false** |
| `VALUATION_ENGINE_PRODUCTION_ACTIVATED` | **false** |
| `ENVIRONMENT` | **simulation** |
| All `LIVE_*` flags | **false** |

Development/simulation may exercise the full pipeline. Production economics remain disabled.

---

## 15. Related Documents

- `docs/architecture/WAVE3_PROOF_BOUND_MONETARY_TRANSITIONS.md`
- `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`
- `docs/architecture/SUNREY_ECONOMIC_INFORMATION_FLOW.md`
- `docs/runbooks/SUNREY_HUMAN_ECONOMY_INCIDENT_RESPONSE.md`
