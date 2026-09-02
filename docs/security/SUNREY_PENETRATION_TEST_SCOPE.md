# SunRey Penetration Test Scope

**Wave 9 — External penetration-test scope definition**  
**Date:** 2026-09-02 (UTC)  
**Commit:** `1a6eafa55ece2446c65ca2a5320370df896e7240`

---

## Status

```
EXTERNAL_PENTEST_EXECUTED=false
ENVIRONMENT=simulation
All LIVE_*=false
PRODUCTION_HSM_KMS_CONFIGURED=false
MAINNET_ACTIVE=false
```

**This document does not claim that a penetration test has been executed, scheduled, or passed.** SunRey Range adversarial scenarios are engineering tests, not independent pentest certification.

Prior scope: `docs/productization/SUNREY_EXTERNAL_PENTEST_SCOPE.md`

---

## 1. Engagement posture

| Item | Value |
| --- | --- |
| Target class | Simulation / preproduction candidate |
| Production money | Disabled |
| Live banks / rails / KYC | Disabled |
| Mainnet | Off |
| HSM/KMS | Not configured |
| Expected outcome | Vulnerability findings; not a production go-live letter |

Testers must not be given a shared universal internal API key, production HSM material, or any path that flips `LIVE_*` or `ENVIRONMENT`.

**Do not perform unauthorized third-party testing** against production systems, live provider networks, or external infrastructure not under written authorization.

---

## 2. In-scope surfaces

### Web and API

| Surface | Owner | Test focus |
| --- | --- | --- |
| Platform API `/api/v1` | `services/api` | Authn/z, IDOR, injection, SSRF, rate limits, error leakage, CORS |
| Consumer BFF / orchestration | `services/api` consumer routes | Cross-user, mass assignment, orchestration bypass |
| OpenAPI contracts | `api/` | Spec vs implementation drift |
| Webhooks ingress | `packages/security` ProviderWebhookGuard | Signature, replay, timestamp skew |
| Developer platform | `packages/sunrey-sdk/src/developer-platform` | API keys, sandbox isolation |

### Mobile / API identity

| Surface | Owner | Test focus |
| --- | --- | --- |
| Session lifecycle | `packages/identity` | Bearer reuse, refresh rotation, fixation |
| MFA / step-up | `packages/identity` | Bypass, downgrade |
| WebAuthn / passkeys | `packages/identity` | Simulation path; origin binding |
| Cross-user isolation | identity + API | IDOR on accounts, PEG, wallet |

### Admin and privileged operations

| Surface | Owner | Test focus |
| --- | --- | --- |
| Staff roles / SoD | `packages/identity/src/staff/` | Privilege escalation, dual-control bypass |
| Break-glass | security productization | Time-bound, audited, no EA mint |
| Control room | `packages/sunrey-chain/src/ops/control-room` | Read-only vs mutating actions |
| Production activation paths | production-handoff, mainnet-gate | Confirm no activation without gates |

### Identity and wallet

| Surface | Owner | Test focus |
| --- | --- | --- |
| Wallet keys | `packages/sunrey-chain/src/wallet/` | Delegation scope, recovery, mobile sync |
| Custody simulation | `packages/custody` | Withdrawal state machine, Travel Rule fixtures |
| PDV | `packages/personal-data-vault` | Subject binding, encryption, export |
| Consent / purpose | `packages/consent` | Purpose mismatch, revocation |

### Exchange

| Surface | Owner | Test focus |
| --- | --- | --- |
| Order placement / cancel | `packages/sunrey-exchange` | Cross-user, authz, idempotency |
| Settlement / DVP | production-core | Race conditions, partial fill abuse |
| Consumer portfolio APIs | `src/consumer/` | Read isolation |
| Market data injection | `src/market-data/` | Price cannot mint; reference guards |

### Blockchain node and RPC

| Surface | Owner | Test focus |
| --- | --- | --- |
| JSON-RPC | `packages/sunrey-chain/rust/crates/rpc` | Replay, wrong chain ID, admin method exposure |
| Transaction submission | node mempool | DoS, oversized payloads, signature malleability |
| P2P handshake | `packages/sunrey-chain/node/src/handshake.rs` | Genesis mismatch, peer impersonation |
| Public RPC / sentry | public data plane docs | Untrusted plane assumptions |

### P2P (where deployed in test harness)

| Surface | Owner | Test focus |
| --- | --- | --- |
| Dev validator mesh | `packages/sunrey-chain/node/` | Partition, eclipse (lab only), gossip spam |
| Interop relayers | `rust/crates/interop` | Wrong-chain relay, replay (simulation) |

### Provider connectors

| Surface | Owner | Test focus |
| --- | --- | --- |
| Payment / banking adapters | `packages/payments/src/production-candidate` | Callback forgery, state machine bypass |
| KYC / AML candidates | `packages/kernel/src/compliance/provider-candidate` | Webhook injection |
| Custody candidates | `packages/custody/src/provider-candidate` | Withdrawal authz |
| Oracle connectors | `packages/sunrey-chain/src/oracle/production/runtime.ts` | Fake observations must not mint |
| Card adapters | `packages/cards` | PCI-minimized simulation boundaries |

### Infrastructure and cloud configuration

| Surface | Owner | Test focus |
| --- | --- | --- |
| Network zones | `docs/infrastructure/network-zones.md` | Segmentation when deployed |
| Secrets handling | `packages/security`, `packages/persistence/src/production` | No secrets in logs/env leaks |
| TLS configuration | infrastructure docs | Weak ciphers, cert validation |
| IAM / workload identity | `docs/infrastructure/workload-identity.md` | Over-privileged service accounts |
| Database exposure | persistence adapters | Connection string leakage, SQL injection via ORM boundaries |

### AI and agent

| Surface | Owner | Test focus |
| --- | --- | --- |
| Agent runtime | `packages/sunrey-agent` | Prompt injection, tool isolation |
| AI runtime | `packages/ai-runtime` | Data exfil via context |
| ProposalGate | proposal-gate | EA minting, beneficiary modification |
| Grow proposals | `packages/platform/grow` | Bind tampering, idempotency |

### Access economy and information market

| Surface | Owner | Test focus |
| --- | --- | --- |
| Access rights | `packages/sunrey-chain/src/access/` | Title vs access confusion |
| HIN network | `packages/information-market` | Consent bypass, privacy budget |
| Rights marketplace | information-market/rights-marketplace | `PRODUCTION_ACTIVE=false` enforcement |

---

## 3. Explicitly out of scope

Unless a later written authorization letter expands scope:

- Live bank, card, FX, or KYC vendor production networks
- Commercial HSM / KMS appliances (interface review only)
- Mainnet validators and production genesis ceremony keys
- Physical data-center or office intrusion
- Social engineering of counsel, regulators, or customers
- Destructive attacks against any production environment
- Third-party SaaS not under SunRey control
- Attempts to re-enable `LIVE_*` in source as a "finding" (compiled false by design)
- Unauthorized scanning of external provider endpoints

---

## 4. Suggested test classes

1. **Privilege escalation** — staff, admin, agent tool boundaries
2. **IDOR / cross-tenant** — accounts, wallets, orders, PDV subjects
3. **Secret leakage** — logs, errors, Agent context, API responses, events envelope
4. **Webhook abuse** — invalid, stale, replayed, cross-environment callbacks
5. **Mass assignment** — `userId`, `role`, `kyc`, `authority` fields
6. **SSRF** — webhook destinations, provider URL configuration
7. **Injection** — SQL (via adapters), template, command (build scripts if exposed)
8. **Open redirects** — OAuth/login flows
9. **RPC abuse** — admin paths, HSM export attempts, consensus manipulation
10. **Agent attacks** — privileged-tool injection, Execution Authority minting
11. **Economic abuse** — oracle→mint paths, supply manipulation, double-spend
12. **Exchange abuse** — settlement race, withdrawal without reservation
13. **Kernel bypass** — mutators without Execution Authority
14. **Production signing** — while `PRODUCTION_HSM_KMS_CONFIGURED=false`
15. **Supply-chain** — dependency confusion (against SBOM)

---

## 5. Rules of engagement

| Rule | Detail |
| --- | --- |
| Environment | Designated preproduction/simulation hosts only |
| Data | Synthetic fixtures; no production customer data |
| Rate limits | Respect documented limits; coordinate DoS with SunRey |
| Destructive tests | Prohibited without explicit approval per test case |
| Evidence handling | Findings via secure channel; no public disclosure without agreement |
| Retest | CRITICAL/HIGH require retest before limited-live |

---

## 6. Evidence package for testers

| Artifact | Path |
| --- | --- |
| This scope | `docs/security/SUNREY_PENETRATION_TEST_SCOPE.md` |
| Security audit package | `docs/security/SUNREY_EXTERNAL_SECURITY_AUDIT_PACKAGE.md` |
| Security baseline | `docs/productization/SUNREY_SECURITY_BASELINE.md` |
| Threat models | `docs/security/audit-readiness/threat-model-stride.md` |
| Trust boundaries | `docs/security/audit-readiness/trust-boundaries.md` |
| OpenAPI | `api/` |
| Auth model | `docs/security/audit-readiness/auth-architecture.md` |
| Internal test results | Output of `npm run security:test` (not a substitute) |

---

## 7. Deliverables expected from firm

1. Executive summary and scope confirmation
2. Methodology (OWASP, PTES, or equivalent)
3. Findings with severity, reproduction steps, affected component
4. Evidence (request/response, screenshots where applicable)
5. Remediation recommendations mapped to owners
6. Retest letter for resolved CRITICAL/HIGH items

---

## Related documents

- `docs/security/SUNREY_EXTERNAL_SECURITY_AUDIT_PACKAGE.md`
- `docs/security/INDEPENDENT_SECURITY_AUDIT_SCOPE.md`
- `docs/production/SUNREY_MAINNET_ACTIVATION_PRECONDITIONS.md`
