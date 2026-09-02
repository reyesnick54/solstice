# SunRey Human Economic Intelligence Capability Matrix

**Status:** Wave 6 exit-gate audit (2026-09-02)  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`  
**Legend:** **IMPLEMENTED** · **PARTIAL** · **SIMULATION** · **TEST_ONLY** · **NOT_IMPLEMENTED** · **BLOCKED** · **FUTURE_WAVE**

This matrix assesses the **sovereign Wave 6 — SunRey Human Economic Intelligence** program (see `SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` §19), not the separate external-data “Wave 6” knowledge-intelligence provider program under `packages/external-data/src/wave6/`.

---

## Ontology and identity

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Human Economic Ontology | IMPLEMENTED | `packages/human-economic-contribution/src/taxonomy.ts`, Chunk 104 docs |
| Contribution Categories | IMPLEMENTED | 13 `CONTRIBUTION_CLASSES`; settlement eligibility separate from taxonomy |
| Human Economic Contribution Graph | PARTIAL | HIN + Human Contribution Registry + PEG `contributionId`; no Wave 6 HEG specialization |
| Pseudonymous Human Identity | SIMULATION | HIN `SubjectRef`, `registerSubject({ internalRef })`; no production federation |
| Identity Assurance | PARTIAL | `packages/identity` KYC/ActorContext; not bound to HEC `SubjectRef` mesh |
| Identity Recovery | PARTIAL | Identity service recovery paths; no durable HEC subject recovery store |
| Wallet/Identity Separation | IMPLEMENTED | Wallet/custody IDs distinct from `SubjectRef`; tests in bridge and HIN |
| Sybil Resistance | PARTIAL | Anonymous-subject block, HIN replay keys; explicit disclaimer — not global Sybil mesh |

---

## Attestation and verification

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Human Attestation Source Classes | IMPLEMENTED | `SOURCE_CLASSES` in taxonomy; class→source mapping in verification policy |
| Contribution Attestation Mesh | FUTURE_WAVE | Specified in Wave 4 completion §16; not implemented |
| Credential Verification | SIMULATION | Verification engine evidence kinds `ATTESTATION`, `INDEPENDENT_ATTESTATION` |
| Contribution Verification Policies | IMPLEMENTED | `HumanContributionVerificationEngine`, engineering + production-candidate policies |
| Human Information Consensus | PARTIAL | HIN network engine; Wave 4 IC facts do not grant mint authority |
| Usage Receipts | IMPLEMENTED | HIN usage receipts required for information-right classes |
| Selective Disclosure Boundary | SIMULATION | Clean-room computation hashes; PDV off-chain |

---

## Rights, consent, privacy

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Consent | SIMULATION | `packages/consent`, HIN `HumanInformationConsentGrant`; DB migration `V038` partial |
| Purpose Limitation | IMPLEMENTED | HIN contribution invariants; purpose mismatch rejection |
| Authorized Data Contribution | IMPLEMENTED | Distinct from raw personal data; `RAW_PERSONAL_DATA_FORBIDDEN` |
| Human-Worth Prohibition | IMPLEMENTED | `humanWorthScore: false` typed flags; `scanForbiddenPayload`; DB PEVE constraint |

---

## Contribution resolution and deduplication

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Canonical Human Contribution Event | IMPLEMENTED | `HumanContributionEvent`, registry record lifecycle |
| Contribution Fingerprinting | IMPLEMENTED | `fingerprintEconomicEvent()` deterministic on event material |
| Contribution Deduplication | SIMULATION | `DUPLICATE_FINGERPRINT` in registry; in-memory only |
| Cross-Source Resolution | PARTIAL | `EconomicClaimRegistry` + alias resolver in `economic-proof`; not wired to Chunk 108 |
| Multiple-Wallet Protection | PARTIAL | Conceptual separation; no durable cross-wallet monetization lock |
| Cross-Identity Conflict Detection | PARTIAL | Economic-proof cluster tests; not production-durable on bridge path |
| Verified Human Economic Contribution | IMPLEMENTED | Registry `VERIFIED` state; bridge `validateVerifiedContribution` |

---

## Valuation (PEVE)

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| PEVE | SIMULATION | `HumanContributionValuationEngine`; PostgreSQL `V012__peve.sql` for snapshots |
| PEVE Methodology Versioning | IMPLEMENTED | Versioned policies, constitution `VALUATION_IS_NOT_HUMAN_WORTH` |
| PEVE/Market Separation | IMPLEMENTED | No exchange price in valuation path; `MARKET_REFERENCE` is governed schedule only |
| Human-Worth Prohibition | IMPLEMENTED | See above; adversarial range scenarios |

---

## SunRey monetary pipeline

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| SunRey Issuance Proposal | SIMULATION | Chunk 108/112 bridge → `authorizeIssuance` with development authority |
| SunRey Monetary Policy Boundary | IMPLEMENTED | Chunk 71 sole gate; bridge firewall |
| SunRey Governance Binding | SIMULATION | `HumanContributionSettlementAuthorization`; production inactive |
| SunRey Proof-Bound Issuance | PARTIAL | `EconomicProofBundle` types in `economic-proof`; Chunk 108 does not require bundle |
| SunRey Economic Receipt | SIMULATION | Settlement records in-memory; no durable issuance receipt store |
| Human Claim Challenges | PARTIAL | Supersession/correction policy on bridge; append-only; no durable challenge journal |
| Attestation Reputation | NOT_IMPLEMENTED | Source trust in provider-sdk; no human attestation reputation mesh |
| Domain Circuit Breakers | NOT_IMPLEMENTED | Exchange/payments breakers exist; none on human verification domain |

---

## Production and mainnet

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Production HIN | BLOCKED | `LIVE_HIN_BASED_ISSUANCE_ENABLED=false`; `LIVE_DATA_MONETIZATION_ENABLED=false` |
| Production SunRey Issuance | BLOCKED | `PRODUCTION_ACTIVATED=false` in bridge types; Chunk 143 firewall |
| Mainnet SunRey Economics | BLOCKED | Chunks 164–167 ceremony; `AUTHORIZED_CANDIDATE` ≠ `MAINNET_ACTIVE` |

---

## Authority boundaries (verified)

| Layer | Can mint / issue EA? | Status |
| --- | --- | --- |
| HumanIdentityService / identity package | No | PASS |
| HIN / information-market | No | PASS |
| ContributionAttestationMesh | N/A | NOT IMPLEMENTED |
| ContributionVerifier / verification engine | No | PASS |
| ConsentService | No | PASS — `CONSENT_ALONE_CANNOT_ISSUE` |
| RightsService / HIN rights | No | PASS |
| HumanEconomicGraph / PEG | No | PASS |
| InformationConsensus | No | PASS |
| HumanEconomicClaim / economic-proof | No | PASS — `claimCannotAuthorizeIssuance` |
| PEVE / valuation engine | No | PASS — `VALUATION_RESULT_CANNOT_MINT` |
| AI Agent | No | PASS |
| Consumer API | No | PASS |
| Exchange | No | PASS |
| Validator consensus alone | No | PASS |

---

## Test coverage

| Suite | Scope |
| --- | --- |
| `packages/human-economic-contribution/src/*.test.ts` | Registry, verification, valuation, HIN value, ontology |
| `packages/information-market/src/network*.test.ts` | HIN, contribution adapter, chain anchor, adversarial |
| `packages/sunrey-chain/src/economics/human-contribution*.test.ts` | Chunk 108/112 bridge, settlement |
| `packages/sunrey-chain/src/economic-proof/economic-proof.test.ts` | Wave 3 claim registry, human duplicate scenarios |
| `tests/chunk-108-human-contribution-monetary-bridge.test.ts` | Chunk 108 exit criteria |
| `tests/wave3-economic-proof-red-team.test.ts` | Monetary authority red team |
| `tests/access-18-human-information-to-access.test.ts` | BFF HIN surfaces, no human-worth |
| `packages/sunrey-range/src/scenarios/human-economy.ts` | 9 adversarial human-economy scenarios |
| `performance/human-economy/baseline.ts` | Wave 6 synthetic performance baseline |

---

## Conservative summary

Substantial **simulation-grade** human economy scaffolding exists (Chunks 100–112, Wave 3 economic-proof types). Wave 6-specific deliverables — durable Human Economic Contribution Graph, Contribution Attestation Mesh, cross-source dedup wired to monetization, durable anti-replay issuance, verification-domain circuit breakers — remain **PARTIAL**, **SIMULATION**, or **FUTURE_WAVE**.
