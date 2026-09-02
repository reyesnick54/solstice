# SunRey Human Economic Contribution Graph

**Status:** Simulation projection layer  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags remain `false`  
**Owner:** `packages/sunrey-chain/src/human/ontology/graph.ts`  
**Extends:** Wave 4 Economic Knowledge Graph (`packages/economic-asset-registry/src/knowledge-graph`)

---

## 1. Role

The Human Economic Contribution Graph is a **non-authoritative, rebuildable intelligence projection** above verified human contributions. It:

- links pseudonymous actors to governed contribution events
- binds evidence, attestations, methodology, consent, and purpose
- resolves contribution events to `CanonicalEconomicClaim` nodes
- **does not** store balances, mint SunRey, or score human worth

The authoritative source of truth for verified contributions remains `packages/human-economic-contribution` registry records and Wave 3 claim fingerprints.

---

## 2. Graph model

```text
PseudonymousHuman (PSEUDONYMOUS_PERSON)
    ├── PERFORMED ──────────► WorkContribution (ECONOMIC_EVENT)
    ├── DEMONSTRATED ───────► Skill (ECONOMIC_EVENT)
    ├── EARNED ─────────────► Credential (ECONOMIC_EVENT)
    ├── CONTRIBUTED_TO ─────► Research (ECONOMIC_EVENT)
    ├── AUTHORIZED ─────────► DatasetUse (ECONOMIC_EVENT)
    ├── PARTICIPATED_IN ────► Computation (ECONOMIC_EVENT)
    └── GRANTED ────────────► Consent (RIGHTS_GRANT)
                                  └── FOR_PURPOSE ──► Purpose (RIGHTS_GRANT)

Contribution (ECONOMIC_EVENT)
    ├── SUPPORTED_BY ───────► Evidence (EVIDENCE)
    ├── ATTESTED_BY ────────► Attestation (VERIFIED_FACT)
    ├── USES_METHODOLOGY ───► Methodology (METHODOLOGY)
    └── RESOLVES_TO ────────► EconomicClaim (ECONOMIC_CLAIM)
```

Relation kinds are registered in `packages/economic-asset-registry/src/knowledge-graph/ontology.ts` as `HUMAN_EVENT_TEMPLATES`.

---

## 3. Projection API

`projectHumanContributionToGraph()` accepts:

| Input | Output nodes/edges |
| --- | --- |
| `HumanContributionEventMaterial` | actor node, contribution node, actor→contribution edge |
| `evidenceRefs` | `SUPPORTED_BY` edges to evidence nodes |
| `attestationRefs` | `ATTESTED_BY` edges to attestation nodes |
| `methodologyId` | `USES_METHODOLOGY` edge |
| `consentRefs` + `purposeRefs` | `GRANTED` and `FOR_PURPOSE` edges |
| optional `claimId` | `RESOLVES_TO` economic claim edge |

All nodes use `domain: 'HUMAN_ECONOMY'`. Payloads must pass `assertHumanNodePrivacy()` — no raw dossier fields.

---

## 4. Privacy boundary

| On graph | Off graph |
| --- | --- |
| `pseudonymousId` / `externalRef` | Legal name, email, government ID |
| contribution class and event type | Raw PDV ciphertext |
| evidence / attestation digests | Consent document text |
| purpose identifiers | Health records, DNA, communications |

Human graph nodes use `PSEUDONYMOUS_PERSON` class. `FORBIDDEN_HUMAN_PAYLOAD_KEYS` in `knowledge-graph/privacy.ts` is enforced at registration time.

---

## 5. Relationship to other graphs

| Graph | Relationship |
| --- | --- |
| Personal Economic Graph (PEG) | Per-subject intelligence; not authoritative for contribution verification |
| Productive Economic Graph (Wave 5) | Separate `PRODUCTIVE_ECONOMY` domain; no shared mint path |
| Economic Asset Registry | Cross-domain metadata; human adapter at `human-economic-contribution/economic-asset-adapter.ts` |
| HIN network graph | Usage receipts feed contribution evidence; chain anchors are non-authoritative |

---

## 6. Information flow

```text
HIN usage receipt / attestation / institutional evidence
        │
        ▼
HumanContributionEventMaterial (Wave 6 ontology validation)
        │
        ├──► Human Contribution Registry (verify)
        │
        ├──► Information Consensus (human safety extensions)
        │
        ├──► Human Economic Contribution Graph (this document)
        │
        └──► CanonicalEconomicClaim (HUMAN_ECONOMIC)
                    │
                    ▼
             Valuation (PEVE / reference — non-minting)
                    │
                    ▼
             Settlement authorization + Chunk 71 gate
```

Graph projection occurs **before** valuation and **long before** any SunRey supply mutation.

---

## 7. Fixtures

Development fixtures in `packages/sunrey-chain/src/human/ontology/fixtures.ts`:

| Fixture | Domain |
| --- | --- |
| `EMPLOYMENT_WORK_EVENT` | Work / professional expertise |
| `RESEARCH_CONTRIBUTION_EVENT` | Research with consent and rights |
| `EDUCATION_MILESTONE_EVENT` | Educational achievement |
| `SKILL_DEMONSTRATION_EVENT` | Skill application |
| `AUTHORIZED_COMPUTATION_EVENT` | Computation participation |
| `AUTHORIZED_DATASET_EVENT` | Authorized dataset contribution |

Negative fixtures: `PROFILE_NOT_CONTRIBUTION`, `HUMAN_ATTRIBUTE_LOCATION`, `CREDENTIAL_EXISTS_NOT_EARNED`, `EMPLOYMENT_WITHOUT_WORK`, `PAPER_WITHOUT_CONTRIBUTION`.

---

## 8. Tests

| Suite | Path |
| --- | --- |
| Ontology unit tests | `packages/sunrey-chain/src/human/ontology/human-ontology.test.ts` |
| Repository integration | `tests/wave-6-human-economic-intelligence.test.ts` |
| Knowledge graph privacy | `packages/economic-asset-registry/src/knowledge-graph.test.ts` |

---

## 9. Remaining gaps

1. Durable human contribution graph persistence across restart (shared Wave 3/8 gap)
2. HIN → claim registry durable linkage with anti-replay persistence
3. SunRey Contribution Attestation Mesh (publication DB, researcher registry dedup) — future wave
4. Cross-subject graph query purpose enforcement at federation boundary — Wave 7
5. Production valuation policy activation — remains inactive (`LIVE_HIN_BASED_ISSUANCE_ENABLED=false`)

---

*End of SunRey Human Economic Contribution Graph — Wave 6 Prompt 1.*
