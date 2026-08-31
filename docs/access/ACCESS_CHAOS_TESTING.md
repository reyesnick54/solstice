# ACCESS Chaos Testing (Wave 5 / Prompt 41)

This document describes the Access chaos and integration test harness introduced in Prompt 41. Tests run entirely against fixtures, mocks, and sandbox adapters — never against live commercial providers.

## Harness location

| Path | Purpose |
|------|---------|
| `packages/access-economy/src/chaos/harness.ts` | Extends Wave 3 test stack; mobility checkout helpers |
| `packages/access-economy/src/chaos/invariants.ts` | Reusable invariant checks for CI |
| `packages/access-economy/src/chaos/metrics.ts` | Latency percentiles and utilization helpers |
| `packages/access-economy/src/chaos/secret-scan.ts` | Static scan for forbidden credential patterns |
| `packages/access-economy/src/chaos/privacy.ts` | Provider payload PII boundary checks |
| `packages/access-economy/src/chaos/access-chaos.test.ts` | Primary chaos scenario suite (35 cases) |
| `tests/access-41-chaos.test.ts` | Top-level CI entry point |

Run:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  --test --test-reporter=spec \
  packages/access-economy/src/chaos/access-chaos.test.ts \
  packages/access-economy/src/transaction/access-wave3.test.ts \
  tests/access-41-chaos.test.ts
```

## Core invariants (always verified)

1. `ConsumedAccessUnits <= AllocatedAccessUnits`
2. `ReservedAccess + ConsumedAccess <= AllocatedAccess`
3. `CommittedAccessFunding <= EligibleAvailableFunding`
4. `FundingAvailable >= 0`
5. `RefundedAmount <= CapturedAmount`
6. `ProviderSettlement == approved contribution sum`
7. No duplicate provider booking
8. No duplicate payment capture
9. `TokenConversionContribution == 0`

Use `checkAccessChaosInvariants()` from `chaos/invariants.ts` after any scenario.

## Scenario coverage

| # | Scenario | Test reference |
|---|----------|----------------|
| 04 | Double-click confirm idempotency | `04 double-click confirm` |
| 05 | Multi-device entitlement race | `05 multi-device entitlement race` |
| 06 | Funding pool race (10 × $200 on $1k) | `06 funding pool race` |
| 07 | Quote expiry during checkout | `07 quote expiry` |
| 08 | Provider price increase → requote | `08 provider price change` |
| 09 | Lost booking response → reconciliation | `09 lost booking response` |
| 10 | Booking fails after user auth → compensate | `10 booking fails after auth` |
| 11 | Payment succeeds / booking fails | `11 payment succeeds booking fails` |
| 12 | Booking succeeds / payment fails | `12 booking succeeds payment fails` |
| 13 | Duplicate CAPTURED webhook | `13 duplicate payment webhook` |
| 14 | Duplicate BOOKING_CONFIRMED webhook | `14 duplicate booking webhook` |
| 15 | Out-of-order webhooks | `15 out-of-order webhooks` |
| 16 | Lost webhook → reconciliation | `16 lost webhook` |
| 17 | Provider outage stages | `17 provider outage` |
| 18 | Payment issuer outage | `18 payment issuer outage` |
| 19 | All commercial providers down | `19 all providers down` |
| 20 | Funding exhaustion | `20 funding exhaustion` |
| 21 | Treasury pause (`NEW_REDEMPTIONS_PAUSED`) | `21 treasury pause` |
| 22 | Provider quarantine mid-transaction | `22 provider quarantine` |
| 23 | Security deposit over-authorization | `23 deposit over-authorization` |
| 24 | Unrelated merchant card attempt | `24 unrelated merchant` |
| 25 | Authorization above card limit | `25 authorization above limit` |
| 26 | Single-use card reuse | `26 card reuse` |
| 27 | Full refund reconciliation | `27 full refund` |
| 28 | Duplicate refund blocked | `28 duplicate refund` |
| 29 | Partial refund allocation | `29 partial refund` |
| 30 | Multiple partial refunds bounded | `30 multiple partial refunds` |
| 31 | Non-refundable cancellation | `31 non-refundable cancellation` |
| 32 | User no-show | `32 user no-show` |
| 33 | Reconciliation mismatch detection | `33 reconciliation mismatches` |
| 34 | Unsafe auto-reconciliation prohibited | `34 unsafe auto-reconciliation` |
| 35 | Client tampering rejected | `35 client tampering` |
| 36 | Resource ownership attack | `36 resource ownership` |
| 37 | Replay attack | `37 replay attack` |
| 38 | Webhook security | `38 webhook security` |
| 39 | SSRF / provider URL safety | `39 SSRF controls` |
| 40 | Secret leak scan | `40 secret scan` |
| 41 | PII / privacy boundary | `41 privacy boundary` |
| 42 | Compliance failure proxy | `42 compliance failure` |
| 43 | SR/MR regression (zero token conversion) | `43 SR/MR regression` |
| 45–46 | Concurrent checkout load + settlement batch | `45-46 concurrent checkout` |
| 49 | Invariant suite after chaos | `49 invariant suite` |

Wave 3 tests (`access-wave3.test.ts`) provide additional orchestrator, saga, and webhook coverage that complements the chaos suite.

## Defects discovered and fixed during Prompt 41

| Defect | Fix |
|--------|-----|
| Settlement `orchestrator.ts` merge corruption | Split virtual-card and fiat orchestrators |
| Quote expiry not enforced on reserve/book | `orchestrator.ts` rejects `QUOTE_EXPIRED` |
| Funding pool suspend missing | `suspendPool()` / `resumePool()` on funding pool |
| Reconciliation gaps for duplicate booking/payment | Expanded `AccessReconciliationService` issue types |
| Duplicate `AccessCoverageEngine` star export | Renamed transaction engine to `AccessTransactionCoverageEngine` |
| Test quotes expiring before fixture clock | `withFutureQuoteExpiry()` in test harness |

## Blockchain independence (§44)

Access chaos tests do not invoke SunRey Chain consensus. Blockchain regression is covered by the existing `packages/sunrey-chain` test suite and constitution checks. Access outages must not affect chain consensus — verified by architectural isolation (Access is application-layer over ownership/evidence, not a consensus dependency).

## Performance baseline (§45–46)

The load test (`45-46 concurrent checkout`) runs 20 parallel checkouts against the simulation stack. Typical results on CI hardware:

- p50 &lt; 5 ms per checkout step (in-memory fixtures)
- No duplicate bookings or captures under concurrency
- Funding and entitlement reservations remain bounded

Use `buildLatencyPercentiles()` from `chaos/metrics.ts` for ad-hoc measurement.

## CI integration

Add `tests/access-41-chaos.test.ts` to the project's test glob (already wired). The invariant suite should run on every Access-related PR.
