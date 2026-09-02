# SunRey Privacy, Identity, Policy and Authorization Capability Matrix

**Status:** Wave 7 exit-gate audit (2026-09-02)  
**Environment:** `ENVIRONMENT=simulation`; all `LIVE_*` flags `false`; `PRODUCTION_HSM_KMS_CONFIGURED=false`  
**Legend:** **IMPLEMENTED** · **PARTIAL** · **INTERFACE_ONLY** · **SIMULATION** · **TEST_ONLY** · **NOT_IMPLEMENTED** · **BLOCKED** · **FUTURE_WAVE**

This matrix assesses the sovereign **Wave 7 — Privacy / Identity / Policy** control plane (`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md` §19). It is distinct from the external-data provider Wave 7 program (`packages/external-data/src/wave7/`).

---

## Policy plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Policy-as-Code | SIMULATION | `packages/kernel/src/policy/` — typed JSON packs + deterministic `PolicyEngine` (ADR-0006 Option C) |
| OPA Integration | NOT_IMPLEMENTED | ADR-0006 rejects OPA sidecar for simulation; no Rego runtime |
| Policy Versioning | IMPLEMENTED | `PolicyRegistry`, `resolvePolicyVersion`, pack lifecycle events |
| Decision Receipts | IMPLEMENTED | `ComplianceKernel.submit` → `EvidenceVault.seal('KERNEL_DECISION')` |
| Policy Obligations | PARTIAL | Structural gates + rule effects; obligation fulfillment not durable across all planes |
| Fail-Closed Policy | IMPLEMENTED | Missing pack/version/jurisdiction → `DEFER`/`BLOCK`; `ENVIRONMENT !== simulation` blocks grants |

---

## Authorization plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Fine-Grained Authorization | IMPLEMENTED | `AuthorizationContext`, `ProductCapability`, `ResourceOwnershipRegistry` |
| OpenFGA Integration | NOT_IMPLEMENTED | No Zanzibar/tuple store; capability model is canonical |
| Relationship Authorization | PARTIAL | Service identity + resource ownership; no graph relationship engine |
| Delegation | SIMULATION | Agent mandates (`packages/sunrey-agent`), wallet delegated keys (`packages/sunrey-chain/src/wallet/authorization.ts`) |
| Auditor Access | IMPLEMENTED | `AUDITOR` → `ADMIN_AUDIT` only; SoD denies writes (`packages/identity/src/staff/sod.ts`) |
| Separation of Duties | IMPLEMENTED | Dual-control actions, step-up, production-activation forbidden for staff |

---

## Identity plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Identity Federation | INTERFACE_ONLY | ADR-0007 proposed; fixture provider candidates only (`packages/identity/src/provider-candidate/`) |
| Keycloak Integration | NOT_IMPLEMENTED | No live IdP wiring |
| Service Identity | SIMULATION | `packages/security/src/identity.ts` — `ServiceIdentityRegistry`, capability checks |
| Pseudonymous Economic Identity | PARTIAL | Human contribution fingerprints, subject commitments; no durable pseudonym registry |
| Wallet/Identity Separation | IMPLEMENTED | Chain wallet keys ≠ login identity ≠ economic subject (`docs/architecture/sunrey-chain-authority-matrix.md`) |
| Governance Identity Separation | IMPLEMENTED | Staff roles explicit; no `SUPER_ADMIN`; governance ops distinct from validators |
| Validator Identity Separation | IMPLEMENTED | `packages/sunrey-chain/src/validators/`; validator signing ≠ monetary governance |

---

## Privacy plane

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Data Minimization | IMPLEMENTED | PDV `findForbiddenPayloadField`, identity log redaction, API `redactRecord` |
| Log Redaction | IMPLEMENTED | `services/api/src/logging.ts`, `packages/events/src/envelope.ts`, provider-sdk redaction |
| Private Computation Boundary | SIMULATION | `packages/clean-room/` — aggregate egress only; no TEE |
| Differential Privacy | NOT_IMPLEMENTED | — |
| Privacy Budget | PARTIAL | HIN privacy budget (`packages/information-market`); not fabric-unified |
| Provider License Enforcement | SIMULATION | Rights evaluation + provider definition license policy (`packages/provider-sdk`, `economic-proof/rights`) |
| Data Retention | PARTIAL | Consent retention instructions + purpose expectations; not all stores enforce TTL durably |
| Data Residency | PARTIAL | Jurisdiction packs + operating-scope matrix; residency rules representable, not fully enforced at persistence |
| Regulatory Feature Gates | SIMULATION | Chunk 161 operating scope, production-activation firewall, `OPERATIONS_CONTROL_FLAGS` |

---

## Selective disclosure / credentials

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Verifiable Credentials | INTERFACE_ONLY | `InformationMarketService.vcPort` — `SIMULATION_ONLY` |
| Selective Disclosure | INTERFACE_ONLY | Clean-room aggregate receipts; no production VC presentation layer |
| Zero-Knowledge Proof Integration | INTERFACE_ONLY | `zkPort.proveSimulation` — `SIMULATION_ONLY`; ADR-0030 research |

---

## Jurisdiction and consent

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Jurisdiction Context | IMPLEMENTED | `resolveJurisdiction`, policy packs US/GB/EU/SA/AE, operating-scope facts |
| Regulatory Control Profiles | SIMULATION | `packages/regulatory-twin/`, Chunk 161 matrix — counterfactual only |
| Purpose Registry | IMPLEMENTED | `packages/consent/src/purpose-registry.ts`, `PurposeFirewall` |
| Consent Ledger | IMPLEMENTED | Append-only consent history; purpose-bound permits |
| Legal Hold | PARTIAL | Operations cases + evidence retention; no unified legal-hold orchestrator |

---

## Keys, secrets, and privileged access

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| Key Classification | IMPLEMENTED | `packages/security/src/purposes.ts`, productization taxonomy |
| Secret Management | SIMULATION | `SecretReference`, simulation key provider; no raw secrets in domain config |
| HSM/KMS Integration | INTERFACE_ONLY | `KeyProvider` port; `PRODUCTION_HSM_KMS_CONFIGURED=false` |
| Governance Signing | PARTIAL | Chunk 165 ceremony rehearsal; production keys not generated |
| Secret Rotation | SIMULATION | `KeyProvider.rotateKey`, productization rotation policy schema |
| Break-Glass | SIMULATION | `PrivilegedAccessRegistry.openBreakGlass` — recorded; cannot post journals |
| Privileged Audit | IMPLEMENTED | Evidence sealing on kernel decisions; privileged session audit refs |

---

## AI and monetary boundary

| Capability | Status | Owner / evidence |
| --- | --- | --- |
| AI Authority Isolation | IMPLEMENTED | `packages/agent` isolation, `ProposalGate`, no EA from agent path |
| Mainnet Activation Ceremony | BLOCKED | Chunks 164–167 rehearsal; `evaluateMainnetRuntimeGate().passed === false` |
| Monetary Authority Separation | IMPLEMENTED | Chunk 71 `authorizeIssuance` sole supply gate; policy/auth/identity/consent cannot mint |

---

## Cross-wave invariant status (referenced by Wave 7 exit gate)

| Wave | Control-plane relevance | Status |
| --- | --- | --- |
| Wave 2 blockchain | No raw PII on chain; mainnet fail-closed | **INTACT** |
| Wave 3 economic proof | Rights/consent commitments; proof ≠ mint | **PARTIAL** (sovereign roots still incomplete per Wave 3 report) |
| Wave 4 awareness fabric | Purpose-aware queries partial; no bulk surveillance path | **PARTIAL** |
| Wave 5 MoonRey | Oracle mesh ≠ mint | **INTACT** |
| Wave 6 SunRey human | HIN boundary; no human-worth score | **PARTIAL** |

---

## Summary

The repository implements a **simulation-grade, TypeScript-native control plane** with a unified policy-decision boundary at the Compliance Kernel, purpose firewall, identity separation, and monetary fail-closed gates. **OPA, OpenFGA, Keycloak, production HSM/KMS, differential privacy, and production ZK/VC are not implemented** — by design in simulation. Wave 8 must wire product paths to these boundaries with durable persistence without weakening them.
