# Access V1 Production Readiness Scorecard

Evaluated: 2026-08-31. Assessor: engineering certification (Prompt 42). Posture: conservative. `ENVIRONMENT=simulation`.

**Overall engineering readiness: `PASS_WITH_LIMITATIONS`**

Engineering simulation and domain foundations are strong. Production launch requiring real provider payment is **`BLOCKED`** pending external gates.

---

## Scorecard

| Area | Status | Reason |
| --- | --- | --- |
| Architecture | **PASS** | Canonical owners documented; no parallel ledger/Kernel |
| Allocation Engine | **PASS** | TWAB + policy + preview/finalize tested |
| Entitlement Ledger | **PASS** | Allocate, reserve, consume, release; concurrency tests |
| Funding Ledger | **PASS** | Pool, reservation, capture, refund entries |
| Solvency | **PASS** | Exhaustion detection; category pools; invariants |
| Provider Discovery | **PASS_WITH_LIMITATIONS** | Simulation + Expedia sandbox only |
| Commercial Provider Network | **PASS_WITH_LIMITATIONS** | Five adapters; all partner-gated or sandbox |
| Provider SDK | **PASS_WITH_LIMITATIONS** | Gateway + capability registry; not unified with `packages/provider-sdk` |
| Quote / Coverage | **PASS_WITH_LIMITATIONS** | `evaluateRedemption` + policies; no standalone QuoteEngine service |
| Settlement | **PASS_WITH_LIMITATIONS** | Funding router emits intents; no live payment capture |
| Virtual Card | **BLOCKED** | `authorizeCardAdapterInvocation` rejects production issuance |
| Booking | **PASS_WITH_LIMITATIONS** | RedemptionWorkflow + canonical orchestrator (simulation) |
| Cancellation | **PASS_WITH_LIMITATIONS** | Provider cancel + entitlement release (simulation) |
| Refund | **PASS_WITH_LIMITATIONS** | Funding ledger refund entries; partial mapping tested; no live rail |
| Reconciliation | **PASS_WITH_LIMITATIONS** | Ledger evidence + ACCESS-16 liability lifecycle; no `AccessReconciliationIssue` operator type |
| BFF | **PASS_WITH_LIMITATIONS** | Routes exist; some integration tests blocked by `handler.ts` parse error |
| Action Center | **BLOCKED** | No Access-specific Action Center cards wired |
| Receipts | **BLOCKED** | No dedicated Access receipt BFF surface |
| Consumer Protection | **PASS_WITH_LIMITATIONS** | Coverage explanations; deposit not charged to Access in tests; disclosures partial |
| Accounting | **PASS_WITH_LIMITATIONS** | Evidence refs; CPA treatment not approved |
| Treasury | **PASS_WITH_LIMITATIONS** | Pool limits + exhaustion; Access-specific treasury kill switch not isolated |
| Compliance | **PASS_WITH_LIMITATIONS** | Kernel gating on capacity reservation; corridor policy `RESEARCH_REQUIRED` |
| Privacy | **PASS** | No raw PAN/CVV in Access paths; PII minimization in BFF |
| Security | **PASS_WITH_LIMITATIONS** | Provider security interfaces; platform baseline; no Access-specific threat model doc |
| Reliability | **PASS_WITH_LIMITATIONS** | Circuit breaker defaults; provider outage degrades discovery only |
| Observability | **PASS_WITH_LIMITATIONS** | Redemption metrics counters; no Access ops dashboard |
| Operations | **PASS_WITH_LIMITATIONS** | Platform runbooks exist; no Access-specific runbook pack |
| Performance | **PASS** | In-process p99 < 50ms for core paths (certification harness) |
| Documentation | **PASS** | Wave 1 + architecture + this scorecard complete |
| Provider Contracts | **BLOCKED** | No production commercial agreements |
| Payment Rail Contracts | **BLOCKED** | No production payment/BaaS agreement for Access settlement |
| Production Credentials | **BLOCKED** | All providers simulation or sandbox |

---

## Component inventory (Prompt 42 §2)

| Component | Status |
| --- | --- |
| Access Domain | **PASS** |
| AccessCategory / AccessUnit / AccessProduct / AccessCapacity | **PASS** |
| AccessAllocationEngine | **PASS** |
| TWAB | **PASS** |
| AccessAllocationPolicy | **PASS** |
| AccessEntitlementLedger | **PASS** |
| AccessFundingPool | **PASS** |
| AccessFundingLedger | **PASS** |
| AccessSolvencyService | **PASS** |
| AccessDiscoveryService | **PASS_WITH_LIMITATIONS** (via provider gateway search) |
| Access Provider SDK | **PASS_WITH_LIMITATIONS** |
| AccessProviderRegistry | **PASS** |
| Commercial Provider Adapters | **PASS_WITH_LIMITATIONS** (simulation/sandbox) |
| AccessCoverageEngine | **PASS_WITH_LIMITATIONS** (`coverage-policy.ts` + `evaluateRedemption`) |
| AccessSettlementOrchestrator | **PASS_WITH_LIMITATIONS** (`RedemptionFundingRouter`) |
| AccessPaymentRail | **BLOCKED** (no production rail) |
| RestrictedVirtualCardAccessRail | **BLOCKED** |
| AccessTransactionStateMachine | **PASS_WITH_LIMITATIONS** (domain statuses; no `PROCESSING_CONFIRMATION`) |
| AccessTransactionOrchestrator | **PASS_WITH_LIMITATIONS** (`RedemptionWorkflow`, canonical orchestrator) |
| AccessReconciliationService | **PASS_WITH_LIMITATIONS** (partial; productive bridge only) |
| Access BFF | **PASS_WITH_LIMITATIONS** |
| Action Center | **BLOCKED** |
| Receipts | **BLOCKED** |
| History / Upcoming | **PASS_WITH_LIMITATIONS** (`/activity`, `/reservations`) |
| Compliance / Risk | **PASS_WITH_LIMITATIONS** |
| Treasury | **PASS_WITH_LIMITATIONS** |
| Accounting / Disclosures | **PASS_WITH_LIMITATIONS** |
| Observability / Alerting | **PASS_WITH_LIMITATIONS** |
| Runbooks | **PASS_WITH_LIMITATIONS** (platform-level) |
| Security | **PASS_WITH_LIMITATIONS** |
| Tests | **PASS_WITH_LIMITATIONS** (package tests pass; BFF integration blocked) |

---

## Certification scenario results

| Scenario | Result | Notes |
| --- | --- | --- |
| Mustang E2E (flow) | **PASS** | Booking + funding composition in simulation |
| Mustang E2E ($300/$100 economics) | **FAIL** | MOBILITY_STANDARD cap $110/day vs prompt $300 |
| Full refund | **PASS** | Cancel restores entitlement hold |
| Partial refund | **PASS** | Source-of-funds math verified |
| Unknown state | **PASS_WITH_LIMITATIONS** | Idempotency prevents duplicate; no `PROCESSING_CONFIRMATION` UX |
| Funding exhaustion | **PASS** | Entitlement visible; reserve fails closed |
| Provider outage | **PASS** | Entitlements readable; search fails |
| Payment outage | **PASS_WITH_LIMITATIONS** | Partial coverage blocked without user approval |
| Compliance hold | **PASS** | Insufficient entitlement blocks preview |
| SR/MR regression | **PASS** | TokenConversionContribution = 0 |
| Money regression | **PASS** | Package ledger tests independent |
| Blockchain regression | **PASS** | Chain access tests independent |

---

## Build / CI (2026-08-31)

| Check | Result |
| --- | --- |
| Access package tests | **PASS** (162/167 access-tagged; 5 BFF integration failures) |
| `npm run ci` | **FAIL** — `package.json` duplicate `test` key (JSON integrity) |
| BFF handler | **FAIL** — `services/api/src/consumer/handler.ts` TypeScript parse error |
| Typecheck | **Not reached** in CI due to preflight failure |
| Certification harness | **PASS** — `tests/access-v1-production-certification.test.ts` |

---

## Pilot vs public launch

| Milestone | Minimum requirements |
| --- | --- |
| Controlled pilot | Gate A partial + one sandbox provider (Expedia) + simulation treasury cap + frontend disclosures + support runbook |
| Public launch | All gates A–I; production payment rail; ≥1 production provider; counsel-confirmed corridors; Action Center + receipts |

See `docs/access/ACCESS_V1_LAUNCH_GATES.md`.
