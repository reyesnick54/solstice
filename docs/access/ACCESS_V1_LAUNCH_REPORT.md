# SunRey Access V1 Launch Report

**Date:** 2026-08-31  
**Prompt:** ACCESS Wave 5 / Prompt 42 — Production Readiness + Launch Certification  
**Classification:** Engineering simulation audit. Conservative assessment.

---

## Executive summary

| Item | Verdict |
| --- | --- |
| **Overall engineering readiness** | **PASS_WITH_LIMITATIONS** |
| **Production launch (real provider payment)** | **BLOCKED** |
| **Sandbox provider onboarding** | **Ready to begin** (Expedia Rapid sandbox path) |
| **Controlled beta** | **BLOCKED** (payment + provider + compliance gates) |

Access V1 engineering delivers a coherent simulation stack: domain models, SR/MR-informed allocation, entitlement and funding ledgers, provider gateway, coverage policy, redemption workflow, canonical orchestrator, and Consumer BFF projection. **TokenConversionContribution = 0** is enforced.

Gaps blocking production: no production payment rail, no production provider contracts/credentials, no Access receipts or Action Center, incomplete reconciliation operator surface, and pre-existing CI/BFF integration failures.

---

## Detailed status (Prompt 42 §37)

| # | Item | Status |
| --- | --- | --- |
| 1 | Overall engineering readiness | **PASS_WITH_LIMITATIONS** |
| 2 | Access Domain | **PASS** |
| 3 | Allocation Engine | **PASS** |
| 4 | TWAB | **PASS** |
| 5 | Entitlement Ledger | **PASS** |
| 6 | Funding Ledger | **PASS** |
| 7 | Solvency | **PASS** |
| 8 | Provider SDK | **PASS_WITH_LIMITATIONS** |
| 9 | Discovery-provider | **PASS_WITH_LIMITATIONS** |
| 10 | Commercial-provider | **PASS_WITH_LIMITATIONS** |
| 11 | Production-capable Access providers | **None** |
| 12 | Providers blocked by contract | Expedia, Turo, DoorDash, Amazon, Airbnb |
| 13 | Providers blocked by credentials | All five |
| 14 | Coverage Engine | **PASS_WITH_LIMITATIONS** |
| 15 | Settlement Orchestrator | **PASS_WITH_LIMITATIONS** |
| 16 | Payment rail status | **BLOCKED** |
| 17 | Virtual-card status | **BLOCKED** |
| 18 | Booking state-machine | **PASS_WITH_LIMITATIONS** |
| 19 | Cancellation | **PASS_WITH_LIMITATIONS** |
| 20 | Refund | **PASS_WITH_LIMITATIONS** |
| 21 | Reconciliation | **PASS_WITH_LIMITATIONS** |
| 22 | Consumer BFF | **PASS_WITH_LIMITATIONS** |
| 23 | Action Center | **BLOCKED** |
| 24 | Receipts/history | **PASS_WITH_LIMITATIONS** (history yes; receipts no) |
| 25 | Consumer-protection | **PASS_WITH_LIMITATIONS** |
| 26 | Disclosure | **PASS_WITH_LIMITATIONS** |
| 27 | Accounting | **PASS_WITH_LIMITATIONS** |
| 28 | Treasury | **PASS_WITH_LIMITATIONS** |
| 29 | Compliance/Risk | **PASS_WITH_LIMITATIONS** |
| 30 | Privacy | **PASS** |
| 31 | Security | **PASS_WITH_LIMITATIONS** |
| 32 | Provider outage test | **PASS** |
| 33 | Payment outage test | **PASS_WITH_LIMITATIONS** |
| 34 | Funding exhaustion test | **PASS** |
| 35 | Double-spend test | **PASS** |
| 36 | Double-payment test | **PASS** (idempotent redemption start) |
| 37 | Mustang E2E certification | **PASS_WITH_LIMITATIONS** (flow yes; $300/$100 economics no) |
| 38 | Full-refund certification | **PASS** |
| 39 | Partial-refund certification | **PASS** |
| 40 | Unknown-state certification | **PASS_WITH_LIMITATIONS** |
| 41 | SR regression | **PASS** |
| 42 | MR regression | **PASS** |
| 43 | Money regression | **PASS** |
| 44 | Blockchain regression | **PASS** |
| 45 | Test count/results | 162 pass / 167 access-tagged (5 BFF integration fail) |
| 46 | Performance | Overview p99 <1ms, search/quote/coverage p99 <50ms (in-process, n=200) |
| 47 | Build result | **FAIL** — CI preflight JSON integrity |
| 48 | Type-check result | **Not reached** in CI |
| 49 | Lint result | **Not reached** in CI |
| 50 | Remaining technical debt | BFF handler parse error; duplicate package.json keys; Action Center; receipts; PROCESSING_CONFIRMATION state |
| 51 | Engineering blockers | CI preflight; handler.ts syntax; BFF integration tests |
| 52 | Provider-contract blockers | All providers lack production agreements |
| 53 | Payment/BaaS blockers | No live merchant settlement; virtual card production blocked |
| 54 | Legal/compliance items | Corridor policy RESEARCH_REQUIRED; counsel confirmation; operating scope |
| 55 | Accounting/tax items | CPA/controller treatment; tax on Access redemption |
| 56 | Frontend work | Home card, checkout, receipts, Action Center, disclosures |
| 57 | Operational work | Access runbook pack; ops dashboard; reconciliation UI |
| 58 | Minimum for controlled pilot | Gate A fix + Expedia sandbox + hard treasury cap + narrow geography + frontend disclosures |
| 59 | Minimum for public launch | All gates A–I PASS |
| 60 | Recommended initial scope | US-FL mobility OR US lodging sandbox; one category; one provider; simulation treasury cap $50k; internal cohort |
| 61 | Ready for regulated production-provider onboarding? | **Yes — sandbox only**, beginning with Expedia Rapid partner/sandbox certification. **Not** ready for live checkout. |

---

## Acceptance criteria (Prompt 42 §36)

| Criterion | Met |
| --- | --- |
| Access Domain passes | Yes |
| Allocation Engine passes | Yes |
| TWAB passes | Yes |
| Entitlement Ledger passes | Yes |
| Funding Ledger passes | Yes |
| Solvency controls pass | Yes |
| Discovery layer passes | Yes (simulation) |
| Provider SDK passes | Yes (limitations) |
| Commercial-provider abstraction passes | Yes (simulation) |
| Coverage Engine passes | Yes (limitations) |
| Settlement Orchestrator passes | Yes (intent-only) |
| Transaction state machine passes | Partial |
| Refund system passes | Partial |
| Reconciliation passes | Partial |
| Consumer BFF passes | Partial |
| Action Center passes | **No** |
| Receipts/history pass | Partial |
| Treasury controls pass | Partial |
| Accounting mapping exists | Yes |
| Disclosure controls pass | Partial |
| Consumer-protection controls pass | Partial |
| Compliance integration passes | Partial |
| Security testing passes | Partial |
| Concurrency testing passes | Yes |
| Idempotency testing passes | Yes |
| Provider outage testing passes | Yes |
| Payment outage testing passes | Partial |
| Funding exhaustion test passes | Yes |
| Mustang E2E passes | Partial |
| Full/partial/unknown refund tests | Partial / Yes / Partial |
| SR/MR/Money/Blockchain regression | Yes |
| Production vs simulation separation | Yes (by design) |
| Documentation complete | Yes |
| Scorecard + gates complete | Yes |
| Build/typecheck/lint pass | **No** |

---

## Artifacts produced (Prompt 42)

| Artifact | Path |
| --- | --- |
| Provider matrix | `docs/access/FINAL_ACCESS_PROVIDER_MATRIX.md` |
| V1 architecture | `docs/access/SUNREY_ACCESS_V1_ARCHITECTURE.md` |
| Production scorecard | `docs/access/ACCESS_PRODUCTION_READINESS_SCORECARD.md` |
| Launch gates | `docs/access/ACCESS_V1_LAUNCH_GATES.md` |
| App store checklist | `docs/access/ACCESS_APP_STORE_LAUNCH_CHECKLIST.md` |
| Certification harness | `tests/access-v1-production-certification.test.ts` |
| This report | `docs/access/ACCESS_V1_LAUNCH_REPORT.md` |

---

## Regulatory questions for outside counsel / providers

1. Are Access entitlements a payment instrument, deposit, or e-money in target corridors?
2. Provider-of-record vs SunRey-of-record for mobility/lodging bookings?
3. Travel Rule / funds flow for user co-pay and provider settlement?
4. State insurance implications for vehicle rental Access coverage?
5. Refund rights when Access pool funded portion is restored vs user fiat?
6. Marketing copy boundaries for SR/MR participation → Access allocation?

**No legal claims made in this report.**

---

## Wave 6 boundary

Access Wave 6 (SR/MR conversion, MoonRey provider settlement, productive capacity settlement) is **explicitly out of scope**. V1 certification is complete for engineering simulation readiness only.
