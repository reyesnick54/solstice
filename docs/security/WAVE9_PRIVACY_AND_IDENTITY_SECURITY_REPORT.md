# Wave 9 — Privacy and Identity Security Report

**Version:** 1.0.0-wave9  
**Date:** 2026-09-02  
**Scope:** Confidentiality, privacy, identity, consent, secrets under realistic compromise scenarios  
**Companion:** `docs/security/SUNREY_DATA_SECURITY_MATRIX.md`, `tests/wave-9-privacy-identity-security.test.ts`

---

## Executive summary

Wave 9 adversarially tested SunRey's privacy architecture across fifteen tasks. The control plane established in Waves 6–7 (consent firewall, PDV minimization, chain commitment policy, safe logging, graph authorization) holds under tested compromise scenarios. Three engineering defects were remediated with regression tests. Remaining risks concentrate on **PARTIAL BFF/API adapter surfaces**, **INTERFACE_ONLY** privacy capabilities, and **durable retention/residency enforcement** not yet fully automated.

---

## 1. Sensitive data findings

### Inventory (Task 1)

Technical inventory is documented in `docs/security/SUNREY_DATA_SECURITY_MATRIX.md`. Bounded databases (`customer`, `ledger`, `evidence`, `security`, `explorer`) partition sensitive data. PDV stores ciphertext only; consent audit forbids `raw_value_logged`; information market constrains `source_record_revealed`.

### Raw sensitive data search (Task 2)

| Pattern | Locations checked | Finding |
| --- | --- | --- |
| Names, email, phone | tests, fixtures, `tests/persistence/consumer-auth.test.ts` | Fixture emails (`@example.com`) only; no production PII |
| Government ID, DNA, health | `packages/personal-data-vault/src/product/minimization.ts` | Forbidden at ingest via `findForbiddenPayloadField` |
| API keys, tokens, private keys | `scripts/secret-scan.py`, CI stage 7 | Scanner passes; test fixtures use obvious fake values |
| Enterprise telemetry | `packages/economic-awareness-fabric` | Normalized to digests; federation strips any residual `rawPayload` |

**Safe locations (no secret values printed):**

- `tests/free-api-catalog.test.ts` — intentional fake secret for negative testing
- `services/api/src/logging.test.ts` — redaction harness with synthetic key material
- `packages/sunrey-range/src/scenarios/` — adversarial fixtures with placeholder tokens

### Wave 7 exposure catalog status

| Surface | Status |
| --- | --- |
| API_RESPONSE / BFF_ADAPTER | **PARTIAL** — highest residual risk |
| DATABASE_QUERY, FEDERATED_QUERY, GRAPH_QUERY | MITIGATED |
| STRUCTURED_LOG, EVIDENCE_OBJECT, CHAIN_PAYLOAD | MITIGATED |

---

## 2. Blockchain privacy findings (Task 3)

- `scanForForbiddenBlockPayload` recursively rejects health, genetic, credential, and financial field names in block payloads.
- `isCommitmentOnlyPayload` enforces allowlisted commitment fields for evidence bundles.
- HIN chain anchoring (`packages/information-market/src/network/chain-anchor/policy.ts`) declares `RAW_PERSONAL_DATA_ON_CHAIN: false` and maintains `HIN_ANCHOR_FORBIDDEN_KEYS` (email, phone, rawPayload, health, genetic, etc.).
- **Gap:** Key-name heuristics do not catch every HIN-forbidden key at scan time (e.g. `email` is policy-forbidden but not in `SENSITIVE_FIELD_MARKERS`). Values are not semantically inspected. Mitigation: policy enforcement at anchor construction, not scan alone.
- **Commitment design:** Domain-separated commitments (`sunrey.human-economic.identity.v1`) reduce naive dictionary attacks on low-entropy identifiers. Low-entropy material is rejected before commitment (`rejectsLowEntropyIdentityMaterial`).

---

## 3. Pseudonymity findings (Task 4)

| Vector | Result |
| --- | --- |
| Wallet → identity | Wallet bindings use commitments; public explorer strips KYC/PDV fields |
| Claim → identity | `humanEconomicIdentityIdFor` derives `heid_*` from commitment material, not email |
| Graph → identity | PEG requires subject match or `OPERATE_ECONOMIC_GRAPH` |
| API → identity | BFF partial — risk remains on pass-through DTOs |
| Events → identity | Actor/subject refs are opaque IDs; sensitive keys blocked |

**Unavoidable linkage:** Public chain address refs and validator metadata are intentionally public. **Mitigation:** no legal identity or raw HIN on chain; explorer default-deny projection.

---

## 4. Graph findings (Task 5)

- `authorizeGraphRead` enforces verified `ActorContext`, `VIEW_ECONOMIC_GRAPH`, and subject match.
- Cross-user traversal denied without `OPERATE_ECONOMIC_GRAPH`.
- Graph DB columns (`attributes_canonical`, `value_canonical`) are not DB-constrained for PII — reliance on projection minimization and access broker.
- Overbroad export: no bulk graph export API without capability gates in tested paths.

---

## 5. Federation findings (Task 6)

- `FederatedQueryEngine` scopes by domain, metric, and provider list.
- **Remediation:** `minimizeObservationEnvelope` / `minimizeFederatedQueryResult` strip any residual `rawPayload` before results leave the fabric (defense in depth; normalization already stores `rawPayloadHash` only).
- Clean room: `rejectArbitraryQuery` blocks SQL; `evaluateEgress` denies `rawRowExport`.
- Purpose bypass: consent firewall blocks wrong-purpose permits (range scenarios INFO-WRONG-PURPOSE, INFO-REVOKED-CONSENT).

---

## 6. Logging findings (Task 7)

- `packages/security/src/safe-logging.ts` redacts tokens, health, financial, consent, genetic, phone, email, location, and psychological field names.
- **Remediation:** expanded `SENSITIVE_KEY_RE` for phone, email, location, DNA, genetic, psychological, communications.
- `assertSafeEventPayload` now recurses into nested objects (see §11).
- Provider SDK redacts credentials from error messages and URLs.

---

## 7. Backup findings (Task 8)

| Backup class | Encryption | Plaintext keys |
| --- | --- | --- |
| SIGNER_SAFETY | Required | Forbidden |
| POSTGRES_APPLICATION_DATA | Required | Forbidden |
| BLOCKCHAIN_STATE | Not required | Public commitments only |
| ENCRYPTED_CONFIGURATION | Required | No vendor creds in source |

`encryptBackup` uses `BACKUP_ENCRYPTION` purpose; `verifySnapshot` detects tampering. Ordinary backups must not contain plaintext private keys — enforced by encryption requirements and secret scan CI.

---

## 8. Insider threat findings (Task 9)

| Role | Control tested | Result |
| --- | --- | --- |
| Support staff | SoD on `PROVIDER_DISABLE` | Denied |
| Developer | No Kernel bypass in services | Structural gating |
| Administrator | Dual-control actions (`DUAL_CONTROL_ACTIONS`) | Requires second approver |
| Auditor | `operatorMayAccessDomain` write=false | Read-only |
| Provider operator | Fixture adapters only; no live creds | Simulation |
| Governance participant | Production activation forbidden for staff | `PRODUCTION_ACTIVATION_FORBIDDEN` |

Privileged actions seal to admin audit log with redaction.

---

## 9. Consent revocation findings (Task 10)

Revoked consent blocks:

| Path | Result |
| --- | --- |
| New permit issuance | `CONSENT_REVOKED` |
| Stale permit after revoke | Firewall denies |
| Wrong purpose | `PURPOSE_MISMATCH` / permit denial |
| Expired consent | `PERMIT_EXPIRED` |
| Recipient mismatch | `PERMIT_RECIPIENT_MISMATCH` |
| Event replay | Consent state checked at permit issue time, not replayed from stale events |
| Federated query | No consent bypass without active grant |
| Agent session | Agent lacks vault credentials; ProposalGate only |

Range scenarios INFO-REVOKED-CONSENT, INFO-EXPIRED-CONSENT, INFO-WRONG-PURPOSE all blocked.

---

## 10. Secret-scan findings (Task 13)

- CI stage 7 runs `scripts/secret-scan.py` with self-test.
- Patterns: AWS keys, GitHub tokens, private key PEM blocks, Bearer tokens, database URLs with credentials.
- Known false positives documented in `docs/security/audit-readiness/vulnerability-register.json` (redaction test fixtures).
- No rotatable real credentials found in repository scan.

---

## 11. Defects fixed (Task 14)

| Defect | Fix | Regression test |
| --- | --- | --- |
| `assertSafeEventPayload` checked top-level keys only | Recursive `collectUnsafeEventPayloadKeys` | `Wave 9 Task 7` nested governmentId test |
| Federation could theoretically return `rawPayload` if present | `minimizeFederatedQueryResult` strips provenance raw payload | `Wave 9 Task 6` federation test |
| Safe logging missed phone/email/location/genetic key names | Expanded `SENSITIVE_KEY_RE` | `Wave 9 Task 7` redaction test |

---

## 12. Remaining privacy risks

1. **BFF/API adapters (PARTIAL)** — `services/api/src/consumer-*.ts` and adapters may pass through provider KYC payloads; map to assertions.
2. **INTERFACE_ONLY capabilities** — SD-JWT, VC, ZK, DP are ports only; must not be marketed as production privacy guarantees.
3. **Event payload depth** — recursive key scan does not detect sensitive *values* in benignly named fields.
4. **Graph DB content** — TEXT columns not DB-constrained; relies on write-path minimization.
5. **Retention/residency** — policy documented; automated enforcement PARTIAL per capability matrix.
6. **Block scan vs HIN policy** — not all policy-forbidden anchor keys are in block scanner markers.
7. **Agent runtime snapshots** — verify minimization at write time under adversarial prompts.
8. **AI inference context** — prompt/context dump paths need production adversarial review.

---

## 13. Files changed

| File | Change |
| --- | --- |
| `packages/events/src/envelope.ts` | Recursive sensitive key detection in event payloads |
| `packages/economic-awareness-fabric/src/federation/query.ts` | Federation result minimization |
| `packages/security/src/safe-logging.ts` | Expanded sensitive key patterns |
| `tests/wave-9-privacy-identity-security.test.ts` | Wave 9 adversarial regression suite (27 tests) |
| `docs/security/WAVE9_PRIVACY_AND_IDENTITY_SECURITY_REPORT.md` | This report |
| `docs/security/SUNREY_DATA_SECURITY_MATRIX.md` | Data inventory matrix |

---

## 14. Validation

```bash
npm ci
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-9-privacy-identity-security.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-7-privacy-preserving-access.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --test tests/wave-7-privacy-identity-policy-red-team.test.ts
python3 scripts/secret-scan.py --self-test
```

Wave 9 suite: **27/27 passed** (2026-09-02).

---

## Selective disclosure (Task 11)

Confirmed `INTERFACE_ONLY` for:

- `SELECTIVE_DISCLOSURE_CAPABILITY`
- `VERIFIABLE_CREDENTIALS_CAPABILITY`
- `ZERO_KNOWLEDGE_PROOF_CAPABILITY`
- `DIFFERENTIAL_PRIVACY_CAPABILITY`

These interfaces define integration boundaries only.

---

## Data deletion (Task 12)

PDV technical deletion tombstones metadata and removes ciphertext without rewriting blockchain history. Ledger journals remain append-only. References to deleted vault assets fail gracefully via lifecycle state (`DELETION_REQUESTED`, `DELETED`, `TOMBSTONED`). Financial history on the canonical ledger is unaffected.

---

## Conclusion

SunRey's privacy architecture **protects Human Economy participants, credentials, consent, and secrets** in tested simulation paths when controls are applied at PDV, consent, chain-anchor, logging, graph, and federation layers. Production privacy guarantees require closing PARTIAL BFF surfaces, binding mature VC/SD/ZK libraries, and completing retention/residency automation. Wave 9 does not activate production or LIVE flags.
