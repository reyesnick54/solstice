# Access Refund and Reconciliation

ACCESS Wave 3 / Prompt 37 — refunds, entitlement restoration, and three-ledger reconciliation.

## Refund allocation

`allocateRefund` (`refund-policy.ts`) implements versioned **proportional** refund by default:

Example: Access $300 + User $100, provider refunds $200 → Access $150 + User $50.

Policies: `PROPORTIONAL_V1` (default), `USER_FIRST_V1`.

Refunded amount never exceeds captured amount per source unless explicit policy permits.

## Entitlement restoration

`AccessEntitlementRestorationPolicy` (`entitlement-restoration-policy.ts`) is category-specific:

| Scenario | Typical outcome |
|----------|-----------------|
| Cancel before service | Restore entitlement units |
| Non-refundable provider terms | No restoration |
| Partial compute use | Restore unused units only |
| No-show under valid terms | No automatic restoration |

Restoration is independent of fiat refund — a refund does not always restore Access units.

## Cancellation

`requestCancellation` maps to `cancel()` on the orchestrator:

- Provider cancellation terms preserved (`providerNonRefundable`)
- Refund promises wait on provider/settlement confirmation
- Penalties and non-refundable fees respected via restoration policy inputs

## Three-ledger reconciliation

`AccessReconciliationService` compares:

1. **Entitlement ledger** — allocated / reserved / consumed units
2. **Funding ledger** — pool received / reserved / captured settlement
3. **Provider booking state** — reservation / booking / fulfillment references

### Issue types (`AccessReconciliationIssue`)

- `BOOKING_WITHOUT_PAYMENT`
- `PAYMENT_WITHOUT_BOOKING`
- `ENTITLEMENT_MISMATCH`
- `FUNDING_MISMATCH`
- `REFUND_MISMATCH`
- `DUPLICATE_PAYMENT`
- `DUPLICATE_BOOKING`
- `UNKNOWN_PROVIDER_STATE`
- `STALE_BOOKING_STATE`

Each issue records severity, expected vs actual state, and resolution status (`OPEN`, `AUTO_RESOLVED`, `ESCALATED`, `MANUAL_RESOLVED`, `DISMISSED`).

## Safe automatic reconciliation

Automatic corrections are limited to deterministic cases:

- Expired funding reservation with confirmed no booking/payment → release
- Duplicate webhook → idempotent ignore
- Known booking after `RECONCILIATION_REQUIRED` timeout → advance to `BOOKED`

Money movement and provider bookings are **not** auto-reversed on uncertain provider truth.

## Manual review

Transactions in `REVIEW_REQUIRED` retain full context for operators: quote, holds, provider refs, payment auths/captures, fulfillment evidence, and open reconciliation issues. Operational data is not exposed on public APIs.

## Out-of-order webhooks

Payment `CAPTURED` may arrive before `AUTHORIZED`. Webhook handler reconciles to the highest known payment state without corrupting the transaction machine.

## Security deposit

Checkout quotes carry `securityDepositMinorUnits` separately from provider settlement. Access pool funding does not cover user-secured deposits by default (Mustang scenario: $500 deposit excluded from Access payment).
