# Access Treasury Risk

> **Disclaimer:** This document describes software architecture and control points only.
> Final legal, accounting, tax, consumer-protection, and regulatory treatment must be
> reviewed and approved by qualified professionals and applicable regulated partners
> before production launch.

## Treasury exposure model

`AccessTreasuryExposure` is derived from actual funding pool balances. It does not
duplicate balance truth.

| Field | Source |
|-------|--------|
| `availableFunding` | Funding pool balance |
| `reservedFunding` | Active reservations |
| `capturedFunding` | Settled captures |
| `pendingRefunds` | Refund reserve |
| `riskReserve` | Risk reserve allocation |
| `refundReserve` | Refund reserve allocation |
| `unsettledProviderExposure` | Pending settlement |
| `userCopayAuthorized` | In-flight user copay holds |
| `userCopayReceivable` | Outstanding user receivables |
| `providerDiscountCapacity` | Non-cash discount capacity |
| `maximumPotentialExposure` | Derived worst-case |
| `status` | `WITHIN_LIMITS` / `APPROACHING_LIMIT` / `LIMIT_BREACHED` / `PAUSED` |

Implementation: `packages/access-economy/src/regulatory-controls/treasury-exposure.ts`

## Treasury risk limits

`AccessTreasuryPolicy` supports configurable limits:

- Global Access spending limit
- Daily settlement limit
- Category limit
- Geography limit
- Provider limit
- Transaction limit
- Unsettled exposure limit
- Refund reserve minimum
- Maximum outstanding authorizations

Default values are safe simulation placeholders only. Production values require
treasury approval.

Implementation: `packages/access-economy/src/regulatory-controls/treasury-policy.ts`

## Treasury kill switch

Operational states:

| State | New funding | New redemptions | Settlements | Refunds | Reconciliation |
|-------|-------------|-----------------|-------------|---------|----------------|
| `NORMAL` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `LIMITED` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `NEW_REDEMPTIONS_PAUSED` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `SETTLEMENTS_RESTRICTED` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `EMERGENCY_RECONCILIATION_ONLY` | ✗ | ✗ | ✗ | ✓ | ✓ |

Kill switch disables **new funding commitments** without disabling:

- Existing entitlements
- History
- Refunds
- Reconciliation
- Existing booking servicing

Implementation: `packages/access-economy/src/regulatory-controls/treasury-kill-switch.ts`

## Solvency hard rules

Invariants enforced at all times:

```
CommittedAccessFunding <= EligibleAvailableFunding
AvailableFunding >= 0
TokenConversionContribution = 0
```

Pool-level locking prevents race conditions on concurrent reservations.
Tests cover multiple categories, currencies, funding sources, and concurrent
transactions.

Implementation: `packages/access-economy/src/funding-solvency/invariants.ts`

## Funding source restrictions in treasury

Treasury and solvency calculations respect funding source restrictions:

- Discount capacity is not counted as unrestricted cash (`availableCashFunding`)
- Employer/sponsor/government program restrictions survive settlement and refunds
- Category-strict pools reject cross-category reservations

## Treasury read ports

ACCESS-16 treasury read ports (`TreasuryReservePort`, `SettlementReserveReadPort`)
remain reference-only. Access does not mint from treasury.

Invariant: `NO_TREASURY_MINT_FROM_ACCESS`

## Items requiring external approval

- Production treasury limit values
- Risk reserve and refund reserve minimums
- Kill switch activation procedures
- Cross-currency exposure aggregation policy
- Concentration limits by provider
