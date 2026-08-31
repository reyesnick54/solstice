# Independent security audit scope

**Recommended scope for a qualified external security firm.**

This document does **not** claim that an independent audit or penetration test
has been commissioned, executed, or passed. Internal Cursor/engineering testing
is **not** independent security certification.

`EXTERNAL_AUDIT_COMPLETE=false`  
`SECURITY_CERTIFIED=false`  
`ENVIRONMENT=simulation`  
`PRODUCTION_HSM_KMS_CONFIGURED=false`

---

## 1. Engagement objectives

Validate security controls, identify exploitable vulnerabilities, and assess
readiness of the simulation/preproduction candidate for a future production
deployment — without requiring production money, live providers, or mainnet.

Deliverables expected from the firm:

- Penetration test report with reproducible findings
- Cryptographic architecture review memo (including PQC hybrid path)
- Dependency/supply-chain review against generated SBOM
- Prioritized remediation list mapped to `docs/security/audit-readiness/vulnerability-register.json`

---

## 2. In-scope assessments

| Workstream | Focus | Canonical entry points |
| --- | --- | --- |
| Web/API penetration test | Authn/z, IDOR, injection, SSRF, rate limits, error leakage | `services/api`, OpenAPI under `api/` |
| Mobile/API authorization | Bearer session, refresh reuse, step-up, cross-user | `packages/identity` |
| Financial-action integrity | Grow proposal bind, EA scope, idempotency, Kernel gate | `packages/platform/grow`, `packages/kernel` |
| Cloud configuration review | TLS, secrets, network zones, IAM (when deployed) | `docs/infrastructure/` |
| Blockchain review | Signature validation, replay, domain separation | `packages/sunrey-chain` |
| Cryptography review | Key purposes, rotation, HSM port, PQC envelopes | `docs/security/cryptographic-inventory.md` |
| PQC architecture | Hybrid signatures, downgrade resistance | `packages/sunrey-chain/src/pqc` |
| Exchange / custody logic | Order authz, withdrawal state machine, Travel Rule | `packages/sunrey-exchange`, `packages/custody` |
| Interop review | Relayer, replay, wrong chain, governance pause | `rust/crates/interop` |
| AI security review | Prompt injection, tool isolation, data exfil | `packages/sunrey-agent`, `packages/ai-runtime` |
| Dependency / supply-chain | npm + Cargo, SBOM accuracy | `npm run security:test` |
| Access Economy / merchant | Merchant isolation, offer integrity | `packages/access-economy` |
| HIN / privacy | Consent, PDV encryption, log redaction | `packages/personal-data-vault`, `packages/information-market` |

---

## 3. Out of scope (unless later written authorization)

- Live bank, card, FX, or KYC production networks
- Commercial HSM/KMS physical assessment (interfaces may be reviewed; appliances may be absent)
- Mainnet validators and production genesis keys
- Physical intrusion / social engineering of counsel or regulators
- Destructive attacks against any production environment
- Third-party SaaS not under SunRey control

Testers must **not** be given:

- A universal internal API god-key
- Production HSM material
- Ability to flip `LIVE_*` or `ENVIRONMENT`
- Real customer accounts or production data

---

## 4. Evidence package (start here)

| Artifact | Path |
| --- | --- |
| Audit-readiness index | `docs/security/audit-readiness/README.md` |
| Asset inventory | `docs/security/audit-readiness/security-asset-inventory.md` |
| Trust boundaries | `docs/security/audit-readiness/trust-boundaries.md` |
| STRIDE threat model | `docs/security/audit-readiness/threat-model-stride.md` |
| Vulnerability register | `docs/security/audit-readiness/vulnerability-register.json` |
| Build status | `docs/security/audit-readiness/build-status.json` |
| Security baseline | `docs/productization/SUNREY_SECURITY_BASELINE.md` |
| Architecture constitution | `docs/architecture/constitution.md` |
| Prior external package | `docs/productization/SUNREY_EXTERNAL_SECURITY_AUDIT_PACKAGE.md` |
| Pentest scope (prior) | `docs/productization/SUNREY_EXTERNAL_PENTEST_SCOPE.md` |

Reproduce internal checks:

```bash
npm install
npm run security:test
npm run lint:architecture
```

---

## 5. Severity and retest expectations

External findings should be reported with CVSS or equivalent severity.
SunRey engineering will map findings into `vulnerability-register.json`.

Retest criteria:

- Fixed issues require proof-of-fix retest by the external firm
- Internal fixes during Prompt 17 are documented with `retest` field in register
- Issues marked `open` are not production-accepted

---

## 6. Status

| Item | Value |
| --- | --- |
| Internal security review (Wave 6 P17) | Complete (engineering) |
| Independent audit | **Required — not started** |
| Penetration test | **Required — not started** |
| Security certified | **false** |

Internal testing by Cursor or CI does not satisfy independent assurance requirements.
