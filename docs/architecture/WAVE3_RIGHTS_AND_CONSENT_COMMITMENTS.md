# Wave 3 — Rights and Consent Commitments

**Version:** 1.0.0-wave3-prompt4  
**Status:** Architectural specification + simulation implementation  
**Owner:** `packages/sunrey-chain/src/economic-proof/rights`  
**Companion:** `docs/architecture/SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` §10, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md` §11

---

## 1. Core principle

```
FACTUAL TRUTH  !=  PERMISSION TO USE
```

Economic evidence may exist without authorization to use it for a given purpose. The Wave 3 rights architecture proves **both**:

1. that referenced economic evidence exists (Evidence commitments — separate module), and  
2. that SunRey was authorized to use it for the **actual requested purpose**.

Additional separations enforced:

| Separation | Meaning |
| --- | --- |
| Observation ≠ monetization | Oracle or HIN observation does not imply commercial use rights |
| Analysis ≠ exposure | Permitted analysis does not imply redistribution or export |
| Purpose A ≠ Purpose B | `CONTRIBUTION_VERIFICATION` does not authorize `MONETARY_PROPOSAL` |
| Consent ≠ valuation | Consent grants use permission, not coin quantity |
| Consent ≠ issuance | Consent never authorizes `MonetaryIssuanceAuthority` |
| License ≠ consent | Productive provider licensing is modeled separately from human consent |

---

## 2. Rights taxonomy

| Object | Economy | Role |
| --- | --- | --- |
| `RightsGrant` | Human + Productive | Versioned authorization to use bounded evidence/data scope for listed purposes |
| `ConsentGrant` | Human | Subject-bound consent distinct from valuation and issuance |
| `PurposeAuthorization` | Both | Extensible, versioned purpose identifiers evaluated on every check |
| `LicenseAuthorization` | Productive | Provider-configured source license; never inferred |
| `RightsCommitment` | Both | Deterministic digest binding the rights context relied upon for a claim |
| `RightsRoot` | Chain | Merkle root over ordered rights commitment deltas |
| `RightsRevocation` | Both | Future-blocking revocation that preserves historical proof |

Canonical implementation: `packages/sunrey-chain/src/economic-proof/rights/`.

### Mapping from existing repository types

| Existing type | Location | Wave 3 relationship |
| --- | --- | --- |
| `ConsentRecord`, `ConsentReceipt` | `packages/consent` | Authoritative off-chain consent ledger; referenced by `proofRef` / commitments |
| `HumanInformationConsentGrant` | `packages/information-market` | HIN network consent; maps to `ConsentGrant` commitments, not issuance |
| `InformationRightRef`, `ConsentGrantRef`, `PurposeRef` | `packages/human-economic-contribution` | Contribution evidence references; resolved to Wave 3 grants at evaluation |
| `RightObject` | `packages/sunrey-chain/src/protocol/rights.ts` | Protocol transaction rights exercise; ACCESS-08 access rights are separate |
| `AccessGrantRecord` | `packages/sunrey-chain/src/access-fabric` | Capacity/access market grants; not human consent |
| Provider license configuration | `packages/sunrey-chain/src/oracle/production/**` | Source for `LicenseAuthorization`; configuration only |

Wave 3 does **not** replace `packages/consent`. It adds a cryptographic commitment layer suitable for block anchoring and economic-proof verification.

---

## 3. Consent architecture (Human Economy)

`ConsentGrant` fields:

- `authorizerRef` — who/what authorized (pseudonymous / reference only)
- `contributionCategory` + `dataCategoryCommitment` — what category/data is covered
- `purposeId` — bound purpose authorization identifier
- `scopeCommitment` — hash of permitted scope labels
- `effectiveFrom` / `effectiveUntil` — duration window
- `revocationRef` — optional revocation reference
- `proofRef` — off-chain consent receipt hash (no raw document on chain)

Hard invariants:

- `authorizesMonetaryIssuance: false` (typed, not runtime-configurable)
- `authorizesEconomicValuation: false` unless explicitly extended in a future schema version
- Sensitive contribution classes (`INFORMATION_RIGHT_CONTRIBUTION`, `CREATIVE_CONTRIBUTION`, `MODEL_TRAINING_CONTRIBUTION`) **fail closed** without consent

---

## 4. Purpose architecture

Versioned purpose identifiers (`PurposeAuthorization`) include:

| Code | Typical use |
| --- | --- |
| `CONTRIBUTION_VERIFICATION` | Verify human/productive contribution evidence |
| `ECONOMIC_VALUATION` | Run valuation engines (does not mint) |
| `RESEARCH` | Aggregated / research processing |
| `AGENT_COMPUTATION` | Bounded agent analysis |
| `MONETARY_PROPOSAL` | Prepare human-review issuance proposal (not mint) |
| `DATA_OBSERVATION` | Read/observe provider observation |
| `AGGREGATE_ANALYTICS` | Derived aggregate analytics |
| `EXPOSURE` | External exposure/export (heavily gated) |

Evaluation **must** pass the actual `requestedPurpose.purposeId`. A grant's `permittedPurposes` and `prohibitedPurposes` lists are both enforced.

---

## 5. Licensing architecture (Productive Economy)

`LicenseAuthorization` represents provider configuration only:

| Field | Values |
| --- | --- |
| `commercialUse` | `ALLOWED` \| `RESTRICTED` \| `FORBIDDEN` |
| `persistence` | `ALLOWED` \| `RESTRICTED` \| `FORBIDDEN` |
| `derivedUse` | `ALLOWED` \| `RESTRICTED` \| `FORBIDDEN` |
| `redistribution` | `ALLOWED` \| `RESTRICTED` \| `FORBIDDEN` |
| `attributionRequired` | boolean |
| `configurationRef` | opaque provider config reference |

The evaluator does **not** infer legal rights beyond declared configuration. `RESTRICTED` and `FORBIDDEN` both deny the requested `licenseOperation`.

---

## 6. RightsCommitment

`RightsCommitment` cryptographically binds:

```
rightsGrantCommitment
+ optional consentGrantCommitment
+ optional licenseAuthorizationCommitment
+ purposeId
+ jurisdiction
+ evaluatedAt
+ economyKind
```

No raw personal data, consent documents, or license text appear in the commitment input. Subject identity is represented only via `subjectCommitment` inside the grant commitment.

---

## 7. RightsRoot

`RightsRoot` is a domain-separated Merkle root (`sunrey.economic-proof.rights-root.v1`) over ordered `RightsDelta` commitments.

Properties:

- deterministic for the same ordered delta set
- stable under leaf reordering when using sorted commitment inputs for block integration
- integrated into `computeBlockStateRoots()` alongside transaction, monetary, and evidence roots

---

## 8. Block integration

`packages/sunrey-chain/src/economic-proof/state-commitment/` computes versioned block roots:

| Root | Domain |
| --- | --- |
| Transaction Root | `sunrey.block.transaction-root.v1` |
| Monetary State Root | `sunrey.block.monetary-state-root.v1` |
| Evidence Root | `sunrey.block.evidence-root.v1` |
| **Rights Root** | `sunrey.block.rights-root.v1` |
| Policy Root | `sunrey.block.policy-root.v1` (Prompt 5 — nullable until present) |

`computeAppHash()` hashes all roots into the block `appHash` preimage. Changing any rights leaf changes `rightsRoot` and therefore `appHash`.

---

## 9. Revocation semantics

| Scenario | Behavior |
| --- | --- |
| Authorization valid at execution time | Preserved in `HistoricalRightsProof` |
| Revocation after finalized transaction | Does **not** rewrite chain history |
| Future use after revocation | Denied (`RIGHTS_REVOKED` / `CONSENT_REVOKED`) |
| Audit trail | `reliedUponRevocationRef` records which revocation was active at later evaluation |

`evaluateRevocationSemantics()` distinguishes execution-time validity from future blocking.

---

## 10. Fail-closed rights evaluation

`evaluateRightsFailClosed()` is the reusable boundary:

- Missing grant → `DENY`
- Missing required consent (human sensitive classes) → `DENY`
- Missing required license (productive) → `DENY`
- Wrong / prohibited purpose → `DENY`
- Expired or revoked (for future use) → `DENY`

No silent `ALLOW`. OPA/OpenFGA may wrap this boundary in Wave 7; domain semantics are defined here first.

---

## 11. Privacy boundary

Off-chain only (never in commitments or chain payloads):

- raw consent documents
- raw license agreements
- government identifiers, email, legal name
- PDV ciphertext or clean-room row content

On-chain / in commitments:

- pseudonymous `subjectCommitment`
- scope / category commitment hashes
- purpose identifiers
- authorization and proof references

---

## 12. Human vs Productive Economy differences

| Aspect | Human Economy | Productive Economy |
| --- | --- | --- |
| Primary authorization | `ConsentGrant` + `RightsGrant` | `LicenseAuthorization` + `RightsGrant` |
| Fail-closed default | Yes for sensitive contribution classes | Yes when license missing |
| Issuance | Never from consent | Never from license alone |
| Source of restrictions | Consent ledger + purpose firewall | Provider configuration only |
| Typical purposes | Verification, research, agent analysis | Observation, verification, valuation input |

---

## 13. Tests

`packages/sunrey-chain/src/economic-proof/rights/rights.test.ts` covers:

- correct purpose permitted / wrong purpose denied
- expired and revoked rights
- historic authorization auditable after later revocation
- missing consent denied
- consent does not mint
- license restriction enforced
- deterministic commitments and roots
- tampering detection
- block `appHash` sensitivity to rights changes
- off-chain document privacy

---

## 14. Non-goals (Prompt 4)

- Policy Root population (Wave 3 Prompt 5)
- OPA/OpenFGA integration (Wave 7)
- Production mainnet activation
- Replacing `packages/consent` ledger or PDV brokers
