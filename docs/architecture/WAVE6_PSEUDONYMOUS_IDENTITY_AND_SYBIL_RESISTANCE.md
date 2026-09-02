# Wave 6 — Pseudonymous Identity and Sybil Resistance

**Version:** 1.0.0-wave6-identity  
**Status:** Architectural specification + simulation implementation  
**Owner:** `packages/human-economic-contribution/src/identity`  
**Companion:** `docs/architecture/chunk-104-human-contribution-ontology.md`, `docs/architecture/WAVE3_RIGHTS_AND_CONSENT_COMMITMENTS.md`, `docs/architecture/WAVE4_ECONOMIC_KNOWLEDGE_GRAPH.md`

---

## 1. Core principle

```
LEGAL IDENTITY  !=  PUBLIC ECONOMIC IDENTITY
PSEUDONYMITY    !=  ANONYMITY WITHOUT ACCOUNTABILITY
```

SunRey needs **uniqueness** without **public identity exposure**.

Human economic participation is attributed to a durable pseudonymous actor (`heaid_`) with a canonical contribution subject (`subj_`). Wallets, login accounts, HIN subjects, and external provider tokens are **controllers** linked to that actor — not substitutes for it.

---

## 2. Identity layers

| Layer | Owner | Role | On-chain / commitment |
| --- | --- | --- | --- |
| Legal / KYC plane | `packages/identity` | Provider verification, KYC metadata, recovery | Evidence Vault refs only |
| SunRey login identity | `packages/identity` | Authentication, sessions, assurance | `idn_*` controller link |
| HIN subject | `packages/information-market` | Information rights network subject | `hisub_*` controller link |
| **Human Economic Identity** | `packages/human-economic-contribution/src/identity` | Canonical economic actor for contributions | `heaid_*` + `subj_*` + commitments |
| Contribution registry | `packages/human-economic-contribution` | Verified contribution records | `subj_` on events |
| Economic knowledge graph | `packages/economic-asset-registry` | `PSEUDONYMOUS_PERSON` projection | `pseudonym:` / `hisub_` / `subj_` refs |
| Wallet custody | `packages/sunrey-sdk` / custody | Signing and wallet control | `wallet_*` controller link |

Wave 6 identity **does not** replace `packages/identity`. It binds economic uniqueness and contribution attribution above authentication without storing raw legal attributes.

---

## 3. HumanEconomicIdentity

Canonical type: `HumanEconomicIdentity`

| Field | Meaning |
| --- | --- |
| `humanActorId` | Durable pseudonymous economic actor (`heaid_`) |
| `pseudonymousSubjectRef` | Canonical contribution subject (`subj_`) |
| `assuranceLevel` | Identity assurance class (see §4) |
| `identityProviderRefs` | Opaque provider references |
| `credentialCommitments` | Credential ownership commitments |
| `uniquenessProofRef` | Active uniqueness proof receipt |
| `status` | `ACTIVE`, `SUSPENDED`, `REVOKED`, `COMPROMISED`, `RECOVERED` |
| `jurisdiction` | Operating jurisdiction where required |

Forbidden on this record: legal name, email, government ID, biometric templates, PDV ciphertext.

---

## 4. Identity assurance levels

| Level | Typical signal |
| --- | --- |
| `UNVERIFIED` | Pseudonymous registration only |
| `ACCOUNT_VERIFIED` | Authenticated SunRey account |
| `CREDENTIAL_VERIFIED` | Verified credential ownership |
| `IDENTITY_VERIFIED` | Provider KYC / identity verification |
| `HIGH_ASSURANCE` | Identity verified + high-assurance step-up |

Contribution classes may require different assurance via policy elsewhere. This module defines classes only — not economic thresholds.

Authentication assurance (`packages/identity/src/assurance.ts`) remains separate from economic identity assurance.

---

## 5. Pseudonymity and commitments

Identity participates in economic proof through domain-separated commitments:

| Commitment | Domain |
| --- | --- |
| `humanEconomicIdentityCommitment` | `sunrey.human-economic.identity.v1` |
| `providerUniquenessCommitment` | `sunrey.human-economic.uniqueness.v1` |
| `credentialOwnershipCommitment` | `sunrey.human-economic.credential-ownership.v1` |
| `externalIdentityCommitment` | `sunrey.human-economic.external-identity.v1` |

Properties:

- No raw personal data in commitment inputs
- Provider subject tokens must be opaque — low-entropy email/name/SSN patterns are rejected
- Aligns with Wave 3 `subjectCommitment` pattern in rights grants

---

## 6. Uniqueness proof boundary

`UniquenessProofReceipt` establishes:

> this economic actor corresponds to one verified participant under the relevant uniqueness policy

without publishing underlying identity documents.

Mechanism:

1. KYC / identity provider returns opaque `providerSubjectToken` (fixture adapters in simulation)
2. `providerUniquenessCommitment(providerRef, token, jurisdiction, saltRef)` is recorded
3. Second actor with same commitment → `UNIQUENESS_CONFLICT`
4. `evidenceCommitment` binds to off-chain Evidence Vault / provider evidence — not raw documents

No custom biometric systems. Reuses provider/KYC architecture references only.

---

## 7. Wallet / identity separation

```
one HumanEconomicIdentity  →  many controller links (wallets, accounts, HIN, credentials)
one canonical subj_          →  contribution uniqueness and registry fingerprints
```

`IdentityControllerLink` kinds:

- `WALLET`
- `CUSTOMER_ACCOUNT`
- `SUNREY_IDENTITY`
- `HIN_SUBJECT`
- `CREDENTIAL`
- `EXTERNAL_IDENTITY`

Links carry explicit `purposes` (`AUTHENTICATION`, `CONTRIBUTION_ATTRIBUTION`, `RECOVERY`, `UNIQUENESS_BINDING`, `WALLET_CONTROL`) and optional `rightsGrantRef` from Wave 3 rights architecture.

The complete identity graph is **not** publicly exposed.

---

## 8. Sybil controls (layered)

`evaluateSybilControls` aggregates deterministic signals:

| Signal | Severity |
| --- | --- |
| `DUPLICATE_PROVIDER_UNIQUENESS` | HIGH |
| `REUSED_EXTERNAL_IDENTITY` | HIGH |
| `REUSED_CREDENTIAL` | HIGH |
| `REUSED_USAGE_RECEIPT` | MEDIUM |
| `DUPLICATE_CONTRIBUTION_PATTERN` | MEDIUM |
| `MULTI_ACCOUNT_VELOCITY` | MEDIUM |
| `DEVICE_ABUSE` | MEDIUM |
| `GRAPH_RELATIONSHIP` | LOW |
| `AI_PATTERN_SUGGESTION` | policy-scored |

Policy outcomes: `ALLOW`, `REQUIRE_REVIEW`, `DENY_FUTURE_ACTION`.

**Invariant:** `autonomousBan: false` on all signals and evaluations. AI may suggest review; it may not independently ban a person or determine monetary guilt.

---

## 9. Recovery

`IdentityRecoverySession` supports:

- wallet key lost → new wallet link + uniqueness proof
- login account changed → new `SUNREY_IDENTITY` link
- identity provider / credential renewed → new credential commitment
- email change → authentication controller swap

Rules:

- Economic history remains on canonical `subj_` / `heaid_`
- Recovery requires evidence + matching uniqueness proof for credential changes
- `RECOVERY_HIJACK_DENIED` when uniqueness proof targets a different human actor

---

## 10. Revocation and compromise

| Status | Future actions | Historical chain |
| --- | --- | --- |
| `SUSPENDED` | Blocked | Preserved |
| `REVOKED` | Blocked | Preserved |
| `COMPROMISED` | Blocked | Preserved |
| `RECOVERED` | Restored (from `REVOKED`) | Preserved |

`IdentityRevocationRecord.rewritesHistoricalChain: false` is typed, not configurable.

---

## 11. Authority boundaries

| This module | Does not |
| --- | --- |
| Register contributions | Mint SunRey |
| Bind pseudonymous actors | Issue Execution Authority |
| Evaluate Sybil policy outcomes | Post ledger journals |
| Record uniqueness proofs | Store raw KYC images |
| Link wallets to humans | Replace `packages/identity` |

---

## 12. Integration map (audit summary)

| Existing system | Relationship |
| --- | --- |
| `packages/identity` | Login/KYC; linked via `SUNREY_IDENTITY` controller + provider refs |
| `packages/information-market` | HIN `hisub_` linked via `HIN_SUBJECT` controller |
| `packages/human-economic-contribution` registry | Contributions use canonical `subj_` from identity |
| `packages/economic-asset-registry` knowledge graph | `PSEUDONYMOUS_PERSON` uses pseudonym refs |
| Wave 3 rights | `subjectCommitment`, consent `authorizerRef`, purpose firewall |
| `packages/sunrey-chain` proof-bound | `subjectCommitment` on economic claims |
| Wallet / custody | `WALLET` controller links only |

---

## 13. Tests

| Suite | Coverage |
| --- | --- |
| `packages/human-economic-contribution/src/identity/identity.test.ts` | Core identity, assurance, uniqueness, Sybil, recovery, revocation |
| `tests/wave-6-pseudonymous-identity-sybil.test.ts` | Package integration export path |

Scenarios: same person/multiple wallets, same identity/new account, distinct people, reused credential, duplicate external identity, wallet recovery, revoked identity, compromised account, new wallet linked to existing actor, Sybil via many accounts, raw legal identity absent from commitments.

---

## 14. Non-goals (this prompt)

- Economic assurance thresholds per contribution class (policy layer)
- Production KYC vendor activation
- OPA/OpenFGA policy engine (Wave 7)
- Replacing HIN consent ledger or PDV
- Prompt 3 scope (not started automatically)
