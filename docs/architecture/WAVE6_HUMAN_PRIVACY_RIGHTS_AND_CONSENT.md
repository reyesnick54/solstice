# Wave 6 — Human Privacy, Rights, and Consent

**Version:** 1.0.0-wave6  
**Status:** Architectural specification + simulation implementation  
**Owner:** `packages/sunrey-chain/src/economic-proof/human-economy`  
**Companion:** `docs/architecture/WAVE3_RIGHTS_AND_CONSENT_COMMITMENTS.md`

---

## 1. Core principle

```
SUNREY SHOULD MONETIZE VERIFIED CONTRIBUTION
NOT HUMAN VULNERABILITY
NOT HUMAN IDENTITY
NOT PRIVATE ATTRIBUTES THEMSELVES
```

Wave 6 specializes Wave 3 generic rights mechanisms (`RightsGrant`, `ConsentGrant`, `PurposeAuthorization`, `RightsRoot`) for the Human Economy. Raw personal data is never an economic contribution. Only explicitly authorized use under a permitted purpose constitutes a contribution event.

---

## 2. Privacy model

| Layer | Role |
| --- | --- |
| **Personal Data Vault** | Subject-bound encrypted storage; ingest gates per category |
| **Consent ledger** (`packages/consent`) | Authoritative off-chain consent records |
| **HIN network** (`packages/information-market`) | Consent, rights, clean-room computation, usage receipts (simulation) |
| **Human contribution registry** (`packages/human-economic-contribution`) | Verified contribution ontology and evidence |
| **Wave 6 Human Economy** (`economic-proof/human-economy`) | Policy classification, purpose separation, authorized contribution, usage receipts, on-chain/off-chain boundary |

Monetization requires verified contribution evidence bound to explicit authorization — not possession of sensitive attributes.

---

## 3. Data classification

Engineering classifications support policy decisions. They are **not** jurisdiction-specific legal conclusions.

| Classification | Typical handling |
| --- | --- |
| `PUBLIC` | No consent required for observation |
| `INTERNAL` | Platform-internal only |
| `CONFIDENTIAL` | Restricted access; commitment on-chain permitted |
| `PERSONAL` | Explicit consent required |
| `SENSITIVE_PERSONAL` | Purpose authorization + consent; elevated proof requirements |
| `HIGHLY_RESTRICTED` | Off-chain only; on-chain commitments flagged for entropy risk |

PDV `ProductClassification` values map to Human Economy classifications via `mapProductClassificationToHumanData()`.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/classification.ts`

---

## 4. HIN data path audit (Task 1)

Static audit manifest: `packages/sunrey-chain/src/economic-proof/human-economy/hin-audit.ts`

| Domain | HIN category | PDV category | Status |
| --- | --- | --- | --- |
| health / wellness | `HEALTH_WELLNESS` | `health_wellness` | Implemented, simulation, **ingest blocked** |
| consumption | `COMMERCE_PREFERENCES` | `consumption` | Implemented, simulation, API exposed |
| entertainment | — | `digital_activity` | Conceptual; ingest blocked |
| goals | — | `goals_preferences` | Implemented, simulation |
| work | `PROFESSIONAL_INFORMATION` | `employment` | Implemented, simulation, API exposed |
| lifestyle | — | — | Conceptual only |
| psychological | — | — | Conceptual; `BEHAVIORAL_TRAIT` forbidden in HEC |
| DNA / genetic | — | `genetic` | Implemented; ingest blocked |
| attention/time | — | `attention_time` | Implemented; HEC `ATTENTION_ENGAGEMENT` |
| education | — | `education` | Implemented; user-declared, not verified transcript |
| location | `MOBILITY_LOCATION` | `mobility_location` | Implemented; ingest blocked |
| communications | — | `communications_metadata` | Implemented; ingest blocked |
| social graph | — | `social_contribution` | Conceptual; metadata only, no graph engine |
| economic activity | `FINANCIAL_ACTIVITY_METADATA` | `financial` | Implemented, simulation, API exposed |

No new sensitive-data ingestion is activated by Wave 6.

---

## 5. Authorized data contribution

Raw data is **not** a contribution.

| Type | Meaning |
| --- | --- |
| `AuthorizedDatasetContribution` | Subject authorized a defined computation/research use; off-chain record referenced by commitment only |
| `AuthorizedComputationParticipation` | Subject participated in an authorized computation; proof that authorized use occurred |

Both types set `rawDataOnChain: false`. On-chain carries commitments and references only.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/contribution.ts`

---

## 6. Consent lifecycle

`HumanEconomyConsentGrant` specializes Wave 3 `ConsentGrant` with:

- **Specific purpose** — `purposeCode` from Human Economy taxonomy
- **Specific scope** — `scopeLabels` checked on every evaluation
- **Specific recipient/system** — `recipientSystemRef`
- **Effective period** — inherited from base `ConsentGrant`
- **Revocation** — lifecycle state + Wave 3 `RightsRevocation` (future-blocking)
- **Renewal** — `renewedFromConsentId` chain; version incremented
- **Version** — `consentVersion`
- **Proof** — `baseConsentGrant.proofRef` (off-chain hash)
- **Usage receipts** — `usageReceiptCommitments`

Vague perpetual blanket consent is avoided: each renewal creates a new grant with explicit version and scope.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/consent.ts`

---

## 7. Purpose limitation

Human Economy purpose codes:

| Code | Wave 3 mapping |
| --- | --- |
| `IDENTITY_VERIFICATION` | `CONTRIBUTION_VERIFICATION` |
| `CONTRIBUTION_VERIFICATION` | `CONTRIBUTION_VERIFICATION` |
| `RESEARCH_USE` | `RESEARCH` |
| `AUTHORIZED_COMPUTATION` | `AGENT_COMPUTATION` |
| `ECONOMIC_VALUATION` | `ECONOMIC_VALUATION` |
| `MONETARY_PROPOSAL` | `MONETARY_PROPOSAL` |
| `PERSONAL_AGENT_USE` | `AGENT_COMPUTATION` |

Authorization for one purpose does **not** imply another, even when Wave 3 codes overlap. Explicit non-implication pairs include:

- `RESEARCH_USE` → `MONETARY_PROPOSAL`
- `PERSONAL_AGENT_USE` → `ECONOMIC_VALUATION`
- `CONTRIBUTION_VERIFICATION` → `MONETARY_PROPOSAL`

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/purpose-controls.ts`, `evaluation.ts`

---

## 8. Minimum necessary data

When verifying contribution, prefer proofs such as:

| Proof kind | Meaning |
| --- | --- |
| `CREDENTIAL_VALID` | Credential valid = true |
| `WORK_RECEIPT_VALID` | Work receipt valid = true |
| `PUBLICATION_CONTRIBUTION_VERIFIED` | Publication contribution verified = true |
| `AUTHORIZED_COMPUTATION_COMPLETED` | Authorized computation completed = true |

All proofs set `underlyingRecordRequired: false`.

---

## 9. Usage receipts

`HumanDataUsageReceipt` records:

- Authorization used (`humanConsentGrantId`, `consentGrantId`, `purposeCode`)
- Service (`serviceRef`)
- Time (`occurredAt`)
- Computation/query (`computationQueryRef`)
- Result evidence (`resultEvidenceRef`)
- Policy version (`policyVersion`)
- Rights commitment digest (`rightsCommitmentDigest`)

`rawSensitivePayload: false` is typed, not configurable.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/usage-receipt.ts`

---

## 10. Off-chain / on-chain boundary

| On-chain | Off-chain |
| --- | --- |
| Subject commitments | Raw personal records |
| Scope commitments | Consent documents |
| Rights/consent grant commitments | PDV encrypted payloads |
| Usage receipt commitments | Computation inputs |
| Off-chain record references | Deletable raw records |

**Deletion:** `handleOffChainRecordDeletion()` marks off-chain records deleted without mutating on-chain commitments. Historical authorization proofs remain valid (`preservesHistoricalProof`).

**Entropy:** `assessCommitmentEntropy()` flags `HIGHLY_RESTRICTED` and low label-count commitments for off-chain-only or salting.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/deletion-boundary.ts`

---

## 11. Revocation semantics

Revocation after historical valid usage does **not** rewrite finalized history.

- `validAtExecutionTime: true` when authorization existed at execution
- `blockedForFutureUse: true` after revocation effective time
- On-chain commitments and usage receipts are immutable

Inherited from Wave 3: `packages/sunrey-chain/src/economic-proof/rights/revocation.ts`

---

## 12. Selective disclosure roadmap

Integration boundary interfaces (no cryptography implemented):

| Port | Future capability |
| --- | --- |
| `VerifiableCredentialPort` | Selective disclosure presentations |
| `ZeroKnowledgeProofPort` | ZK proof verification |
| `PrivacyPreservingComputationPort` | Enclave / MPC execution |

Default: `UNCONFIGURED_SELECTIVE_DISCLOSURE_BOUNDARY` — all ports `null`.

Implementation: `packages/sunrey-chain/src/economic-proof/human-economy/selective-disclosure.ts`

---

## 13. Tests

`packages/sunrey-chain/src/economic-proof/human-economy/human-economy.test.ts` covers:

- Wrong purpose
- Expired consent
- Revoked consent
- Scope mismatch
- Missing consent
- Authorized computation
- Raw sensitive value absent from chain
- Raw sensitive value absent from logs/receipts
- Off-chain deletion preserving historical commitment structure
- Research permission cannot become monetary permission
- Agent permission cannot become dataset monetization permission
- Historical authorization after later revocation
- Consent renewal
- Commitment entropy assessment
- Selective disclosure boundary unconfigured

---

## 14. Relationship to Wave 3

Wave 6 **extends** Wave 3; it does not replace `packages/consent` or HIN runtime stores.

```
HumanEconomyConsentGrant
  └── baseConsentGrant: ConsentGrant (Wave 3)
        └── proofRef → packages/consent ConsentRecord
```

Evaluation calls `evaluateRightsFailClosed()` from Wave 3 after Human Economy policy checks pass.
