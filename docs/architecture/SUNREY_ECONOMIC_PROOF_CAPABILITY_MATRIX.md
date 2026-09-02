# SunRey Economic Proof Capability Matrix

**Program:** Sovereign Architecture Wave 3 — Economic Proof Architecture  
**Date:** 2026-09-02  
**Auditor:** Cloud Agent (Wave 3 final red-team audit)  
**Verdict:** Wave 3 sovereign economic proof is **not implemented** on `main`. This matrix records actual repository state, not aspirational architecture.

**Status legend**

| Status | Meaning |
| --- | --- |
| IMPLEMENTED | Production-candidate or durable simulation with tests |
| PARTIAL | Building blocks exist; sovereign boundary incomplete |
| SIMULATION | In-memory / fixture-only; not durable |
| TEST ONLY | Covered by tests but not wired to product paths |
| NOT IMPLEMENTED | No code artifact |
| BLOCKED | Prerequisite missing |
| FUTURE WAVE | Explicitly deferred to Wave 4+ |

---

## Information Layer

| Capability | Status | Owner / Path | Notes |
| --- | --- | --- | --- |
| EconomicObservation | PARTIAL | `packages/sunrey-chain/src/productive/economy-data/` | Productive plane only; parallel types in Wave 5/6 external-data |
| EconomicEvidence | NOT IMPLEMENTED | — | Spec in `SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` §9–10 |
| VerifiedEconomicFact | IMPLEMENTED | `packages/sunrey-chain/src/oracle/` | Oracle quorum path; does not mint |
| CanonicalEconomicClaim | NOT IMPLEMENTED | — | Closest: `HumanContributionRegistryRecord`, `ProductiveClaimCandidate` |
| Canonical entity identity | PARTIAL | HEC `subjectRef`; productive `objectId` | No cross-domain canonical entity registry |
| Canonical event identity | PARTIAL | `eventReference`, `measurementPeriodEpoch` | Per-domain; not unified |
| Observation fingerprint | PARTIAL | economy-data ingestion hashes | Not bound to sovereign claim registry |
| Claim fingerprint | PARTIAL | `human-economic-contribution/src/fingerprint.ts`, `productive/fingerprint.ts` | Deterministic within each economy |
| Duplicate clusters | NOT IMPLEMENTED | — | Fingerprint dedup only; no cluster graph |
| Lineage | PARTIAL | productive `upstreamContributionIds` | Human lineage via registry projection only |
| Monetization lock | NOT IMPLEMENTED | — | In-memory replay sets only |
| Information Consensus | FUTURE WAVE | Wave 4+ | Explicitly not claimed |

---

## Evidence Commitments

| Capability | Status | Owner / Path | Notes |
| --- | --- | --- | --- |
| EvidenceCommitment | NOT IMPLEMENTED | — | Related: ACCESS `settlementEvidenceCommitment`, external-evidence hash |
| EvidenceRoot | NOT IMPLEMENTED | — | Node `evidence_root` is **validator equivocation** (Chunk 39), not economic proof |
| Evidence inclusion proof | NOT IMPLEMENTED | — | Evidence Vault has hash chain, not Merkle inclusion to block |
| Kernel Evidence Vault | IMPLEMENTED | `packages/evidence/src/vault.ts` | Kernel decisions only; not economic claim batches |

---

## Rights Commitments

| Capability | Status | Owner / Path | Notes |
| --- | --- | --- | --- |
| RightsGrant | PARTIAL | `packages/sunrey-chain/src/access/` | ACCESS-08 access rights; not sovereign RightsRoot |
| ConsentGrant | PARTIAL | `packages/consent/`, HIN engine | In-memory simulation; not durable RightsRoot |
| PurposeAuthorization | PARTIAL | HIN purpose checks, access `scopeCommitment` | Fail-closed on bridge paths where wired |
| LicenseAuthorization | PARTIAL | economy-data `LICENSE_CLASSES` | Ingestion gate only |
| RightsCommitment | NOT IMPLEMENTED | — | ACCESS domain commitments exist but no RightsRoot |
| RightsRoot | NOT IMPLEMENTED | — | Spec only |

---

## Policy Commitments

| Capability | Status | Owner / Path | Notes |
| --- | --- | --- | --- |
| PolicyDefinition | PARTIAL | Chunk 71 constitution, MoonRey policy registry | Versioned within domains |
| Methodology versioning | PARTIAL | valuation policy versions, verification policy versions | No unified PolicyRoot |
| PolicyCommitment | NOT IMPLEMENTED | — | — |
| PolicyRoot | NOT IMPLEMENTED | — | Spec only |
| Historical policy replay | PARTIAL | settlement binds `conversionPolicyVersion` | No block-committed policy snapshot |

---

## Proof Bundles and Issuance

| Capability | Status | Owner / Path | Notes |
| --- | --- | --- | --- |
| EconomicProofBundle | NOT IMPLEMENTED | — | — |
| Proof-bound SunRey issuance | PARTIAL | Chunk 108 bridge + Chunk 71 gate | Evidence-bound; not full proof bundle |
| Proof-bound MoonRey issuance | PARTIAL | value-settlement bridge + Chunk 71 gate | GPUV alone cannot mint |
| One-time claim consumption | PARTIAL | in-memory replay books | Not durable across restart/API instances |
| Economic monetary receipt | PARTIAL | `MoonReyIssuanceReceipt`, settlement records | In-memory simulation |
| Historical proof replay | PARTIAL | Evidence Vault hydrate | No sovereign proof bundle replay |

---

## Block Architecture Roots

| Root | Status | Implementation | Notes |
| --- | --- | --- | --- |
| Transaction Root | IMPLEMENTED | `rust/crates/protocol/src/block.rs` `transaction_root` | ADR-0021 canonical encoding |
| Monetary State Root | NOT IMPLEMENTED | `app_hash` / `state_root` generic | Not split from full app state |
| Evidence Root (economic) | NOT IMPLEMENTED | — | Do not confuse with equivocation `evidence_root` |
| Rights Root | NOT IMPLEMENTED | — | — |
| Policy Root | NOT IMPLEMENTED | — | — |

---

## Anti-Abuse and Separation

| Capability | Status | Evidence |
| --- | --- | --- |
| Observation cannot mint | IMPLEMENTED | `OBSERVATION_CANNOT_MINT`, issuance rejection codes |
| Evidence cannot mint | IMPLEMENTED | Vault seals decisions only; no `authorizeIssuance` import |
| Claim cannot mint alone | IMPLEMENTED | Bridge `refuseStandaloneAttempt` |
| Valuation cannot mint | IMPLEMENTED | `VALUATION_RESULT_CANNOT_MINT`, `sunReyQuantity: null` |
| AI cannot authorize issuance | IMPLEMENTED | `AI_MONETARY_AUTHORIZATION_REJECTED` |
| Oracle cannot authorize issuance | IMPLEMENTED | `ORACLE_OBSERVATION_CANNOT_MINT` |
| Exchange cannot mint | IMPLEMENTED | Phase G red-team; no mint routes |
| API cannot mint | IMPLEMENTED | BFF orchestration only |
| Validator consensus cannot mint | IMPLEMENTED | Consensus finalizes blocks; Chunk 71 separate gate |

---

## Future Systems (Do Not Overstate)

| Capability | Status | Target Wave |
| --- | --- | --- |
| Information Consensus | FUTURE WAVE | Wave 4–6 |
| External provider federation | PARTIAL | Wave 1–7 provider catalogs (simulation) |
| Oracle Mesh | PARTIAL | Chunk 43 simulation quorum |
| Human Contribution Graph | PARTIAL | HEC registry + PEG projection |
| Entity resolution | FUTURE WAVE | Wave 4/5 |
| Source independence scoring | FUTURE WAVE | Wave 4/5 |
| Provider reputation | FUTURE WAVE | Wave 4+ |
| Challenge process (durable) | FUTURE WAVE | Wave 4+ |
| Source corroboration (production) | SIMULATION | economy-data multi-source flags |

---

## Test Coverage

| Area | Test Path | Status |
| --- | --- | --- |
| Wave 3 sovereign red-team | `tests/wave3-economic-proof-red-team.test.ts` | TEST ONLY (documents gaps) |
| Chunk 71 monetary gate | `packages/sunrey-chain/src/economics.test.ts` | IMPLEMENTED |
| Human contribution bridge | `human-contribution-bridge.test.ts` | IMPLEMENTED |
| Productive duplicate rejection | `packages/sunrey-chain/src/productive.test.ts` | IMPLEMENTED |
| Evidence Vault chain | `packages/evidence/src/vault.test.ts` | IMPLEMENTED |
| Node consensus determinism | `packages/sunrey-chain/node/tests/` | IMPLEMENTED |
| Sovereign root determinism | — | NOT IMPLEMENTED |

---

## Summary

| Category | IMPLEMENTED | PARTIAL | NOT IMPLEMENTED / FUTURE |
| --- | --- | --- | --- |
| Core sovereign objects | 1 | 4 | 3+ |
| Five roots | 1 | 0 | 4 |
| Proof bundles | 0 | 4 | 2+ |
| Information consensus | 0 | 2 | 6+ |

**Wave 3 Economic Proof Architecture as specified in the sovereign upgrade plan is not complete.**
