# Access V1 Launch Gates

Definitive gate list for moving Access from engineering simulation to regulated production. **Do not mark external/business gates PASS without evidence.**

## Gate A — Engineering

| Criterion | Status | Evidence |
| --- | --- | --- |
| Access domain tests pass | **PASS** | `packages/access-economy/src/domain/access-domain.test.ts` |
| Allocation + TWAB tests pass | **PASS** | `packages/access-economy/src/allocation-engine/allocation-engine.test.ts` |
| Funding / solvency tests pass | **PASS** | `packages/access-economy/src/funding-solvency/access-30.test.ts` |
| Provider network E2E pass | **PASS** | `packages/access-economy/src/providers/access-14-e2e.test.ts` |
| ACCESS-13/22 qualification pass | **PASS** | `packages/sunrey-economics` catalogs |
| Prompt 42 certification harness pass | **PASS** | `tests/access-v1-production-certification.test.ts` |
| Full CI green | **BLOCKED** | `package.json` duplicate key; `handler.ts` parse error |
| BFF integration tests | **BLOCKED** | Depends on handler fix |

**Gate A verdict: `PASS_WITH_LIMITATIONS`**

---

## Gate B — Payment

| Criterion | Status | Evidence |
| --- | --- | --- |
| Regulated payment provider relationship | **BLOCKED** | No Access-specific production contract |
| Sandbox payment certification | **PASS_WITH_LIMITATIONS** | `packages/payments/src/production-candidate/` |
| Production credentials | **BLOCKED** | `LIVE_PAYMENTS_ENABLED=false` |
| Auth / capture / void / refund | **PASS** (simulation) | Cards + payments candidate tests |
| PCI boundary | **PASS** (design) | `packages/cards/src/pci-boundary.ts` |
| Production-capable payment rail for Access | **BLOCKED** | No live merchant settlement path |

**Gate B verdict: `BLOCKED`**

---

## Gate C — Providers

| Criterion | Status | Evidence |
| --- | --- | --- |
| ≥1 viable production fulfillment path | **BLOCKED** | All providers `BLOCKED_FOR_PRODUCTION` |
| Expedia sandbox available | **PASS** | `SANDBOX_AVAILABLE` |
| Commercial agreements | **BLOCKED** | See provider matrix |
| Production API + credentials | **BLOCKED** | |
| Webhooks + reconciliation | **BLOCKED** | Simulation only |

**Gate C verdict: `BLOCKED`**

---

## Gate D — Compliance

| Criterion | Status | Evidence |
| --- | --- | --- |
| Kernel gating on capacity reservation | **PASS** | `packages/access-fabric/src/authorize.ts` |
| KYC / sanctions integration | **PASS_WITH_LIMITATIONS** | Platform identity; corridor policy `RESEARCH_REQUIRED` |
| Risk engine hooks | **PASS_WITH_LIMITATIONS** | Kernel six proofs |
| Counsel-confirmed access entitlement rules | **BLOCKED** | Not `CONFIRMED_BY_COUNSEL` |
| Operating scope / licensing | **BLOCKED** | Chunk 161 rehearsal only |

**Gate D verdict: `BLOCKED`** (external)

---

## Gate E — Accounting

| Criterion | Status | Evidence |
| --- | --- | --- |
| Access funding ledger mapping | **PASS** (engineering) | Evidence refs on entries |
| Canonical ledger reconciliation design | **PASS_WITH_LIMITATIONS** | Intent-based; not end-to-end automated |
| CPA / controller treatment approved | **BLOCKED** | No external approval on file |
| Tax treatment | **BLOCKED** | Requires external review |

**Gate E verdict: `BLOCKED`** (external)

---

## Gate F — Treasury

| Criterion | Status | Evidence |
| --- | --- | --- |
| Initial funding approved | **BLOCKED** | Business decision |
| Category / provider / transaction limits configured | **PASS_WITH_LIMITATIONS** | Pool + reservation limits in solvency service |
| Risk / refund reserves | **PASS_WITH_LIMITATIONS** | Ledger fields exist |
| Treasury pause / kill switch | **PASS_WITH_LIMITATIONS** | Platform treasury demo; Access-specific switch not isolated |

**Gate F verdict: `BLOCKED`** (external funding)

---

## Gate G — Operations

| Criterion | Status | Evidence |
| --- | --- | --- |
| Monitoring / alerts | **PASS_WITH_LIMITATIONS** | Platform SRE; redemption metrics |
| Runbooks | **PASS_WITH_LIMITATIONS** | `docs/runbooks/sre/provider-outage.md`; no Access pack |
| Support tooling | **PASS_WITH_LIMITATIONS** | BFF activity; no credential-safe ops console |
| Reconciliation operator workflow | **PASS_WITH_LIMITATIONS** | Manual via ledger evidence |

**Gate G verdict: `PASS_WITH_LIMITATIONS`**

---

## Gate H — Product

| Criterion | Status | Evidence |
| --- | --- | --- |
| Frontend Access surfaces | **BLOCKED** | BFF contract exists; app not certified |
| Terms / privacy / refund disclosures | **BLOCKED** | Checklist drafted; links not verified |
| Action Center | **BLOCKED** | Not wired for Access |
| Receipts | **BLOCKED** | No BFF route |
| App store checklist complete | **PASS_WITH_LIMITATIONS** | `docs/access/ACCESS_APP_STORE_LAUNCH_CHECKLIST.md` |

**Gate H verdict: `BLOCKED`**

---

## Gate I — Security

| Criterion | Status | Evidence |
| --- | --- | --- |
| No secrets in repo | **PASS** | CI secret scan (when CI runs) |
| No raw PAN/CVV in Access | **PASS** | Architecture guards |
| Webhook verification interfaces | **PASS** (simulation) | `packages/access-economy/src/providers/security.ts` |
| Idempotency | **PASS** | Reservation + redemption idempotency tests |
| Access-specific penetration test | **BLOCKED** | Not completed |
| Prompt 41 Access security pack | **BLOCKED** | Not found in repository |

**Gate I verdict: `PASS_WITH_LIMITATIONS`**

---

## Launch decision matrix

| Target | Required gates |
| --- | --- |
| Continue engineering / sandbox QA | A (with limitations acceptable) |
| Regulated provider onboarding (sandbox) | A + partial C (Expedia) + I |
| Controlled beta (real money, narrow cohort) | A + B + C + D + F + G + H + I |
| Public launch | All gates PASS |

**Current recommendation:** Engineering may proceed to **regulated sandbox provider onboarding** for Expedia Rapid only, with explicit simulation/production separation and treasury caps. **Do not enable live user checkout.**
