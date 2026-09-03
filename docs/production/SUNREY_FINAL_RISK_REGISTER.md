# SunRey Final Risk Register

**Program:** Wave 9 — Adversarial Testing / Mainnet Readiness  
**Date:** 2026-09-02  
**Owner:** Engineering / Security Program  
**Environment:** `simulation` — no production activation authorized

This register consolidates sovereign program risks (Waves 1–9), vulnerability register findings, and Wave 9 adversarial review outcomes.

---

## Critical risks

| ID | Risk | Severity | Probability | Impact | Owner | Control | Status | Production implication | Required remediation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-W9-001 | Silent ledger/chain dual SunRey supply authority | Critical | Medium | Supply confusion, reconciliation failure at migration | `sunrey-chain` | ADR-0031 boundary; `production_migration_performed=false`; ledger wins until migration ADR | **OPEN** | Cannot activate native SunRey without migration ceremony | Execute versioned `AssetMigrationManifest`; counsel + engineering ADR |
| R-W9-002 | Observation/oracle → mint bypass | Critical | Low | Unauthorized MoonRey/SunRey issuance | `economics/issuance` | Chunk 71 rejection codes; adversarial range 0 breaches | **MITIGATED** | Simulation-verified fail-closed | Maintain Chunk 157 campaign in CI; external economic audit |
| R-W9-003 | AI agent financial execution | Critical | Low | Unauthorized transfers/issuance | `sunrey-agent` | Structural isolation; ProposalGate; `AI_CANNOT_EXECUTE` invariant | **MITIGATED** | Agent ALLOW ≠ Execution Authority | Continue agent red-team; external AI security review |
| R-W9-004 | Fixture-driven production activation | Critical | Low | Live issuance without ceremony | `production-activation` | Chunk 143 firewall; Chunks 164–167 gates; all `LIVE_*` false | **MITIGATED** | `productionActivated: false` enforced | Complete ceremony rehearsal with human authorization |
| R-W9-005 | Reorg ledger rewrite temptation | Critical | Low | Financial history corruption | `sunrey-chain` | `REORG_OBSERVED` invariant; append-only ledger | **ENFORCED** | Journals never rewritten on reorg | External blockchain audit of reorg semantics |

## High risks

| ID | Risk | Severity | Probability | Impact | Owner | Control | Status | Production implication | Required remediation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-W9-006 | No commercial HSM/KMS (SEC-W6-17-003) | High | High (pre-prod) | Key compromise, forged signatures | `packages/security` | `PRODUCTION_HSM_KMS_CONFIGURED=false`; fail-closed signing | **OPEN** | Production keys cannot be deployed | Connect HSM/KMS per `docs/infrastructure/secrets-kms-hsm.md` |
| R-W9-007 | No independent security audit (SEC-W6-17-004) | High | Certain (current) | Unknown exploitable vulnerabilities | Security program | Audit package at `docs/security/audit-readiness/` | **OPEN** | No `SECURITY_CERTIFIED` claim | Engage firm per `INDEPENDENT_SECURITY_AUDIT_SCOPE.md` |
| R-W9-008 | Ledger/evidence crash window (R5) | High | Medium | Duplicate or lost journals | `persistence` | Idempotent replay fabric; outbox abstractions | **PARTIAL** | Financial-adjacent crash window | Coordinated outbox on all mutation paths |
| R-W9-009 | Weak / incomplete Kernel HTTP wiring (R7) | High | Medium | Unauthorized or unaudited mutations | `services/api` | Wave 7 auth hardening; partial wiring | **OPEN** | Wave 8 product integration incomplete | Wire Kernel → EA → postJournal on all financial HTTP mutations |
| R-W9-010 | Legal/regulatory confidence gap (R10) | High | High | Operating in unknown corridors | Governance ops | `RESEARCH_REQUIRED`; no `CONFIRMED_BY_COUNSEL` | **OPEN** | No live regulated rails | Counsel promotion per corridor |
| R-W9-011 | Durable anti-replay gap across restart | High | Medium | Double issuance after crash | `economic-proof` | In-session replay blocks; `usedReplayIds` in-memory | **OPEN** | Restart may lose replay protection | Persist issuance replay keys and monetization locks |
| R-W9-012 | Cross-source duplicate human contribution | High | Medium | Double SunRey settlement for same event | `human-economic-contribution` | Fingerprint dedup; alias resolver partial | **PARTIAL** | Same event via different provider ids | Unified canonical event id + durable cluster enforcement |
| R-W9-013 | Exchange simulation seed paths | High | Low (sim only) | Test confusion if mis-deployed | `sunrey-exchange` | `InMemoryCoinPort.seed` labeled simulation | **ACCEPTED_RISK** | Demo/test only; not production path | Enforce simulation labels; block in production builds |
| R-W9-014 | Container image posture (CI) | High | Medium | Compromised runtime | Infrastructure | `check-container-pins.mjs` | **OPEN** | `sunrey-watcher.Dockerfile` missing non-root HEALTHCHECK | Fix Dockerfile; re-run CI |

## Medium risks

| ID | Risk | Severity | Probability | Impact | Owner | Control | Status | Production implication | Required remediation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-W9-015 | Ephemeral financial-adjacent state (R8) | Medium | Medium | Lost mandates/consent on restart | Multiple | Wave 8 durable migration planned | **OPEN** | Consent/policy durability partial | PostgreSQL default for product paths |
| R-W9-016 | GPUV confused with MoonRey (R11) | Medium | Low | Wrong issuance reasoning | `productive/policy-governance` | Issuance class guards; documentation | **MITIGATED** | GPUV ≠ MoonRey quantity | Economic audit of GPUV path |
| R-W9-017 | Exchange schema unwired (R9) | Medium | Low | Settlement gaps | `sunrey-exchange` | Explicit wave gate | **PARTIAL** | Some exchange writes unwired | Complete Wave 8 exchange persistence wiring |
| R-W9-018 | Stolen access token window (SEC-W6-17-005) | Medium | Medium | Account takeover | `packages/identity` | 15m TTL, revoke, step-up | **ACCEPTED_RISK** | Residual ATO window until external sign-off | External session management review |
| R-W9-019 | Federated query / unified IC incomplete | Medium | Medium | Information-plane inconsistency | `economic-awareness-fabric` | Partial implementation; tests pass monetary boundary | **PARTIAL** | Awareness layer not sole foundation | Complete federation architecture |
| R-W9-020 | Five-root block header population | Medium | Low | Incomplete on-chain proof anchoring | `economic-proof/roots` | `fiveRootCommitment` implemented; extension slots defined | **PARTIAL** | Not all dev blocks commit five roots | Wire roots into block production path |

## Low / informational risks

| ID | Risk | Severity | Probability | Impact | Owner | Control | Status | Production implication | Required remediation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-W9-021 | Edge WAF / cloud KMS external (SEC-W6-17-006) | Low | Medium | Infrastructure attack | Infrastructure | Documented in `network-zones.md` | **OPEN** | External to repo | Cloud configuration review with evidence |
| R-W9-022 | PQC not production-selected | Low | Low (now) | Future quantum threat | `packages/security` | Hybrid envelope; DRAFT PQ suite | **OPEN** | Not quantum-proof | PQ provider selection per security docs |
| R-W9-023 | V1/V2 productive path coexistence | Low | Low | Operator confusion | `productive/` | Guards on V2 path | **MITIGATED** | V2 is canonical governed path | Deprecation plan for V1 rehearsal paths |

---

## Wave 9 attack objective outcomes

| Attack objective | Result | Evidence |
| --- | --- | --- |
| CREATE UNAUTHORIZED SUNREY | **BLOCKED** | `authorizeIssuance` rejects; Chunk 71 gate |
| CREATE UNAUTHORIZED MOONREY | **BLOCKED** | Productive path + `moonreyIssuanceActivated(): false` |
| MONETIZE SAME CLAIM TWICE | **BLOCKED** (session) / **PARTIAL** (restart) | Fingerprint + replay keys; durability gap |
| CREATE FAKE PRODUCTIVE VALUE | **BLOCKED** | Attribution + GPUV guards; `PRODATT-*` scenarios |
| CREATE FAKE HUMAN CONTRIBUTION | **BLOCKED** | Registry + attestation mesh; Sybil partial |
| STEAL USER ASSETS | **BLOCKED** (auth path) | Kernel + EA required; endpoint risk remains |
| GAIN MONETARY GOVERNANCE | **BLOCKED** | AI/validator/admin cannot authorize issuance |
| COMPROMISE VALIDATOR FINALITY | **BLOCKED** (issuance) | Finality ≠ monetary authorization |
| BYPASS CONSENT | **BLOCKED** | Consent ledger wins; purpose enforcement |
| ESCALATE AI AGENT AUTHORITY | **BLOCKED** | `AIAUTH-*` scenarios; no EA from agent |
| CORRUPT EXCHANGE SETTLEMENT | **BLOCKED** | Idempotent settlement; no mint |
| ALTER CANONICAL SUPPLY THROUGH DATABASE | **BLOCKED** | DB is not monetary authority |

---

## Risk acceptance policy

- **OPEN Critical/High:** Not accepted for production activation.
- **ACCEPTED_RISK:** Documented with justification; requires external sign-off before production.
- **MITIGATED:** Controls verified in adversarial testing; residual risk tracked.
- **ENFORCED:** Architectural invariant with CI enforcement.

## Review cadence

- Re-assess after Wave 8 product integration completion.
- Re-assess after external security audit delivery.
- Re-assess before any `LIVE_*` or mainnet ceremony.
