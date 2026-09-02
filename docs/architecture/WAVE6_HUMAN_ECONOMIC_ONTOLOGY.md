# Wave 6 — Human Economic Contribution Ontology

**Status:** Simulation / engineering implementation  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags remain `false`  
**Owner:** `packages/sunrey-chain/src/human/ontology`  
**Companion:** `docs/architecture/SUNREY_HUMAN_ECONOMIC_CONTRIBUTION_GRAPH.md`

---

## 1. Purpose

Wave 6 specializes the sovereign architecture for the **SunRey Human Economy**. SunRey Coin represents governed monetary outcomes originating from **verified human economic contribution** — not from raw personal data, profile metadata, consent alone, or human-worth scores.

This ontology answers, in order:

1. **WHO** — pseudonymous economic actor (`HumanEconomicActor`)
2. **WHAT** — governed contribution event (`HumanContributionEventMaterial`)
3. **WHEN** — bounded temporal interval
4. **WHAT evidence** — privacy-safe evidence references
5. **WHAT attestations** — institutional or network attestations
6. **WHETHER rights and consent** — purpose-bound authorization
7. **WHETHER unique** — `uniquenessDigest` + registry fingerprint
8. **WHETHER claimed** — anti-replay via Wave 3 claim fingerprints
9. **WHAT methodology** — verification methodology identifier
10. **Whether governance permits issuance** — separate Chunk 71 gate (not this layer)

---

## 2. Non-negotiable principles

| Principle | Enforcement |
| --- | --- |
| Raw human data cannot mint | `RAW_HUMAN_DATA_CANNOT_MINT` |
| Contribution event cannot directly mint | `CONTRIBUTION_EVENT_CANNOT_DIRECTLY_MINT` |
| Verification ≠ issuance | `VERIFICATION_DOES_NOT_EQUAL_ISSUANCE` |
| Eligibility ≠ issuance | `ELIGIBILITY_DOES_NOT_EQUAL_ISSUANCE` |
| PEVE ≠ SunRey quantity | `PEVE_DOES_NOT_AUTOMATICALLY_EQUAL_SUNREY_QUANTITY` |
| Consent ≠ valuation | `CONSENT_DOES_NOT_EQUAL_VALUATION` |
| Valuation ≠ human worth | `VALUATION_DOES_NOT_EQUAL_HUMAN_WORTH` |
| AI cannot define human worth | `AI_CANNOT_DEFINE_HUMAN_WORTH` |
| AI cannot approve issuance | `AI_CANNOT_APPROVE_ISSUANCE` |
| Personal data stays off-chain | `PERSONAL_DATA_STAYS_OFF_CHAIN` |
| Human attribute ≠ contribution | `ATTRIBUTE_IS_NOT_CONTRIBUTION` |
| Profile data ≠ contribution | `PROFILE_IS_NOT_CONTRIBUTION` |
| Evidence ≠ contribution | `EVIDENCE_IS_NOT_CONTRIBUTION` |
| Claim ≠ SunRey | `CLAIM_IS_NOT_SUNREY` |

---

## 3. Governance categories

Wave 6 governance categories map to existing Chunk 104 `ContributionClass` values in `packages/human-economic-contribution/src/taxonomy.ts`. No new monetary weights are invented.

| Governance category | Chunk 104 contribution classes |
| --- | --- |
| `WORK_CONTRIBUTION` | `PROFESSIONAL_EXPERTISE`, `HUMAN_SERVICE_DELIVERY` |
| `SKILL_APPLICATION` | `EDUCATION_SKILL_ATTESTATION`, `PROFESSIONAL_EXPERTISE` |
| `EDUCATIONAL_ACHIEVEMENT` | `EDUCATION_SKILL_ATTESTATION` |
| `RESEARCH_CONTRIBUTION` | `RESEARCH_PARTICIPATION`, `VERIFIED_KNOWLEDGE_CONTRIBUTION` |
| `KNOWLEDGE_CONTRIBUTION` | `VERIFIED_KNOWLEDGE_CONTRIBUTION` |
| `AUTHORIZED_DATA_CONTRIBUTION` | `INFORMATION_RIGHT_CONTRIBUTION` |
| `COMPUTATION_PARTICIPATION` | `MODEL_TRAINING_PARTICIPATION` |
| `CREATIVE_CONTRIBUTION` | `CREATIVE_PRODUCTION`, `CREATOR_ROYALTY_EVENT` |
| `COMMUNITY_CONTRIBUTION` | `COMMUNITY_CONTRIBUTION` |
| `ENTREPRENEURIAL_CONTRIBUTION` | `ENTREPRENEURIAL_ACTIVITY`, `ECONOMIC_PARTICIPATION` |
| `CARE_CONTRIBUTION` | `HUMAN_SERVICE_DELIVERY` |
| `OTHER_GOVERNANCE_APPROVED` | `OTHER_GOVERNED_HUMAN_CONTRIBUTION` |

Adding a category **does not** grant settlement eligibility, issuance eligibility, or production activation.

---

## 4. Human economic actor

`HumanEconomicActor` (`packages/sunrey-chain/src/human/ontology/actor.ts`) represents an economic participant without raw legal identity as the default graph identifier.

| Field | Role |
| --- | --- |
| `humanActorId` | Stable actor identifier |
| `pseudonymousId` | Default graph and claim subject reference |
| `identityAssuranceLevel` | `PSEUDONYMOUS_ONLY` … `GOVERNANCE_APPROVED` |
| `jurisdiction` | Required where policy applies |
| `credentialRefs` | Opaque credential digests only |
| `rightsControllerRefs` | Rights controller references |
| `status` | `ACTIVE`, `SUSPENDED`, `REVOKED`, `ARCHIVED` |
| `schemaVersion` | Ontology version pin |

**Forbidden on-chain / in canonical actor objects:** name, SSN, passport, DNA, medical records, communications, full address.

---

## 5. Contribution event types

Explicit event semantics (`packages/sunrey-chain/src/human/ontology/events.ts`):

| Event type | Kind | Notes |
| --- | --- | --- |
| `WorkPerformed` | ACTIVITY | Employment relationship alone is insufficient |
| `SkillDemonstrated` | ACHIEVEMENT | Requires earned-proof attestation |
| `CredentialEarned` | ACHIEVEMENT | Credential existence ≠ earned credential |
| `ResearchPublished` | ACTIVITY | Publication existence only |
| `ResearchContributionVerified` | ACHIEVEMENT | Person actually contributed |
| `AuthorizedDatasetContribution` | AUTHORIZED_USE | Authorized use event, not raw attribute |
| `ComputationContributionCompleted` | ACTIVITY | Bounded authorized computation receipt |
| `EducationalMilestoneCompleted` | ACHIEVEMENT | Milestone earned under attestation |
| `CreativeWorkContributed` | ACHIEVEMENT | Rights-bound creative contribution |
| `CommunityServiceCompleted` | ACTIVITY | Verified community service |
| `EntrepreneurialMilestoneReached` | ACHIEVEMENT | Verified entrepreneurial milestone |
| `CareServiceDelivered` | ACTIVITY | Authorized measurable care delivery |

**Not monetizable by default:** profile creation, app usage, attention, location, health activity.

---

## 6. Human attribute vs contribution

`packages/sunrey-chain/src/human/ontology/controls.ts` enforces:

- `AGE`, `HEALTH_CONDITION`, `LOCATION`, `RACE`, `DNA`, `PSYCHOLOGICAL_PROFILE`, `SOCIAL_CONNECTIONS`, `ATTENTION`, `APP_USAGE`, `PROFILE_METADATA` → `ATTRIBUTE_IS_NOT_CONTRIBUTION`
- Profile creation → `PROFILE_IS_NOT_CONTRIBUTION`
- Consent alone → `CONSENT_IS_NOT_CONTRIBUTION`
- Evidence alone → `EVIDENCE_IS_NOT_CONTRIBUTION`

Sensitive authorized dataset or research contributions monetize the **authorized contribution event**, not the intrinsic human characteristic.

---

## 7. Achievement vs activity

| Existence | Verified contribution |
| --- | --- |
| Credential issued | `CredentialEarned` with earned-proof evidence |
| Employment relationship | `WorkPerformed` with work-performed proof |
| Paper published | `ResearchContributionVerified` with contribution proof |

Controls: `CREDENTIAL_EXISTENCE_IS_NOT_EARNED`, `EMPLOYMENT_RELATIONSHIP_IS_NOT_WORK`, `PAPER_EXISTENCE_IS_NOT_CONTRIBUTION`.

---

## 8. Reused Wave 3/4 infrastructure

| Layer | Owner | Wave 6 usage |
| --- | --- | --- |
| `EconomicObservation` | `economic-proof` | Normalized human evidence inputs |
| `EconomicEvidence` | `economic-proof` | Sealed evidence bundles |
| `VerifiedEconomicFact` | `economic-proof` + Information Consensus | Verified human facts |
| `CanonicalEconomicClaim` | `economic-proof` | `HUMAN_ECONOMIC` domain claims |
| `EvidenceCommitment` | `economic-proof/evidence` | Evidence root batching |
| `RightsCommitment` | `economic-proof/rights` | Consent and purpose binding |
| `PolicyCommitment` | `economic-proof/policy` | Methodology versioning |
| Information Consensus | `economic-awareness-fabric` | Human safety extensions |
| Economic Knowledge Graph | `economic-asset-registry` | Human graph projection |
| Human Contribution Registry | `human-economic-contribution` | Authoritative contribution records |
| HIN adapter | `information-market` + `services/api` | Usage receipts and anchors |
| Chunk 108 bridge | `economics/human-contribution-bridge` | Proof-bound SunRey path |

Wave 6 **specializes interpretation**; it does not fork the Economic Awareness Fabric.

---

## 9. Human economic claim

`buildHumanEconomicClaimBundle()` (`packages/sunrey-chain/src/human/ontology/claims.ts`) specializes `CanonicalEconomicClaim` for `HUMAN_ECONOMIC` with:

- pseudonymous actor
- canonical contribution event
- contribution class and governance category
- temporal context
- evidence, attestations, rights, consent, purpose, provenance
- uniqueness digest
- methodology identifier
- explicit `HUMAN_ONTOLOGY_INVARIANTS`

No direct mint authority. `humanClaimLacksSupplyAuthority()` must return `true`.

---

## 10. Audit summary (Wave 6 Task 1)

| Component | Status |
| --- | --- |
| Human contribution event model (Chunk 104) | **IMPLEMENTED** |
| HIN | **SIMULATION** |
| Contribution classes | **IMPLEMENTED** (`taxonomy.ts`) |
| AuthorizedContributionVector | **PARTIAL** (HIN value engine) |
| Attestations | **IMPLEMENTED** |
| Verification (Chunk 109) | **SIMULATION** |
| Rights / consent | **PARTIAL** (in-memory; Wave 3 rights commitments) |
| Purpose | **IMPLEMENTED** (purpose refs) |
| Provenance | **IMPLEMENTED** |
| Usage receipts | **IMPLEMENTED** (HIN) |
| PEVE | **SIMULATION** — cannot mint |
| economicValueInput | **SIMULATION** — proposal only |
| SunRey issuance proposal | **SIMULATION** — governance gate |
| Replay keys | **PARTIAL** (in-memory settlement book) |
| Eligibility | **IMPLEMENTED** — explicitly not issuance |
| Simulation flags | **IMPLEMENTED** — all `LIVE_*` false |
| Wave 6 ontology layer | **IMPLEMENTED** (this wave) |
| Human economic graph projection | **IMPLEMENTED** (this wave) |
| Durable claim registry | **PARTIAL** (Wave 3 gaps remain) |

---

## 11. Validation

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning --test \
  packages/sunrey-chain/src/human/ontology/human-ontology.test.ts \
  tests/wave-6-human-economic-intelligence.test.ts
```

MoonRey productive ontology and issuance invariants must remain unchanged.

---

*End of Wave 6 Human Economic Contribution Ontology — Prompt 1 only.*
