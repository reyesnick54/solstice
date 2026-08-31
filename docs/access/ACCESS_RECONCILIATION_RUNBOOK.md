# ACCESS Reconciliation Runbook

Operator guide for Access transaction reconciliation issues detected by `AccessReconciliationService`.

## When reconciliation triggers

Reconciliation runs on:

- Scheduled status polls when webhooks are lost
- Explicit `reconcile()` orchestrator calls
- Mismatch detection during settlement or refund processing

Transactions enter `RECONCILIATION_REQUIRED` when local and provider truth diverge.

## Issue types

| Type | Meaning | Typical cause |
|------|---------|---------------|
| `BOOKING_WITHOUT_PAYMENT` | Provider booked, no local capture | Lost payment webhook |
| `PAYMENT_WITHOUT_BOOKING` | Local capture, no provider booking | Booking response lost |
| `ENTITLEMENT_BOOKING_MISMATCH` | Entitlement consumed, booking cancelled | Late cancellation webhook |
| `FUNDING_MISMATCH` | Funding consumed, provider refunded | Refund without local release |
| `REFUND_MISMATCH` | User refunded locally, provider refund missing | Provider refund pending |
| `DUPLICATE_BOOKING` | Multiple booking IDs for one transaction | Retry without idempotency |
| `DUPLICATE_PAYMENT` | Multiple captures for one transaction | Duplicate webhook |
| `STALE_BOOKING_STATE` | Provider state newer than local | Out-of-order events |

## Severity and resolution status

- **CRITICAL** — potential double-spend or treasury exposure
- **HIGH** — financial mismatch requiring human review
- **MEDIUM** — state drift, likely recoverable
- **LOW** — informational drift

Resolution statuses:

| Status | Meaning |
|--------|---------|
| `OPEN` | Awaiting investigation |
| `AUTO_RESOLVED` | Deterministic safe fix applied |
| `REVIEW_REQUIRED` | Human operator must decide |
| `RESOLVED` | Manually closed |
| `ESCALATED` | Compliance or treasury escalation |

## Safe auto-resolution (only deterministic cases)

Automatically fix **only** when all conditions are met:

1. Provider status API returns unambiguous truth
2. Local idempotency records confirm no prior effect
3. Compensation path is reversible without real-money movement ambiguity

**Never automatically:**

- Refund real money when capture state is uncertain
- Cancel real bookings when provider status is ambiguous
- Restore entitlement when refund policy is unclear

When uncertain, escalate to `REVIEW_REQUIRED`.

## Operator procedure

### 1. Identify the transaction

```text
transactionId → AccessTransactionStore.listAll() / BFF GET /access/transactions/:id
```

Check:

- Current state machine status
- Entitlement reservation/consumption
- Funding reservation/commitment
- Payment authorization/capture records
- Provider booking reference

### 2. Query provider truth

Use the provider reconciliation adapter (simulation: `ConfigurableSimulationProvider`).

```text
providerBookingStatus(transactionId, providerBookingRef)
providerPaymentStatus(transactionId, providerPaymentRef)
```

### 3. Compare ledgers

Verify invariants:

- `ConsumedAccess <= Allocated`
- `CommittedFunding <= AvailableEligible`
- `Refunded <= Captured`
- `ProviderSettlement == approved sum`

Use `checkAccessChaosInvariants()` in test/staging environments.

### 4. Apply resolution

| Scenario | Action |
|----------|--------|
| Provider booked, no local booking | Transition to BOOKED, link provider ref |
| Local booked, provider unknown | Poll provider; if not booked, compensate |
| Duplicate capture | Void/refund excess; mark DUPLICATE_PAYMENT resolved |
| Duplicate booking | Cancel orphan booking; mark DUPLICATE_BOOKING resolved |
| Funding/refund mismatch | Apply refund allocation policy; release funding |

### 5. Seal evidence

Every resolution must produce an evidence reference in the Access transaction record. Do not delete reconciliation issues — mark resolved with operator ID and timestamp.

## Lost webhook recovery

1. Detect via reconciliation schedule or operator report
2. Poll provider status API
3. Apply idempotent state transition matching provider truth
4. If provider confirms action already applied locally, mark idempotent no-op
5. If divergence persists, create `AccessReconciliationIssue` and escalate

## Duplicate webhook handling

Duplicate `CAPTURED` or `BOOKING_CONFIRMED` webhooks must:

- Return idempotent success
- Not create duplicate ledger entries
- Not emit duplicate Action Center events or receipts

Verified in chaos tests `13`, `14`, `15`.

## Funding exhaustion vs reconciliation

Funding exhaustion (`EXHAUSTED` solvency status) is not a reconciliation issue. New funded checkout is blocked; existing transactions continue through reconciliation normally.

## Escalation contacts

| Condition | Escalate to |
|-----------|-------------|
| Treasury exposure &gt; policy threshold | Treasury ops |
| Compliance HOLD on related intent | Compliance review |
| Provider quarantine during open transaction | Provider ops + risk |
| Unresolved &gt; 24h | Access on-call |

## Metrics to monitor

- `reconciliation_required_count`
- `reconciliation_backlog_age_p95`
- `duplicate_payment_detection_count`
- `auto_resolved_count` vs `review_required_count`

See `packages/access-economy/src/chaos/metrics.ts` for test harness helpers.
