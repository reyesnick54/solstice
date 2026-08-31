# Access Funding and Solvency (ACCESS-30)

Access Wave 1 Prompt 30 establishes the financial-capacity accounting foundation behind Access. SunRey must not promise more provider-funded Access than it can afford or fulfill.

## Three economic states (never merged)

| State | Examples | Owner |
|-------|----------|-------|
| **Token state** | SunRey Coin, MoonRey Coin | Canonical custody / chain |
| **Access entitlement state** | Mobility days, room nights, GPU hours | `AccessEntitlementLedger` (domain subledger) |
| **Fiat funding state** | USD, SAR committed for provider settlement | `AccessFundingPool` + `AccessFundingLedger` |

At Access launch, `tokenConversionContribution = 0`. The system does not sell, redeem, or convert SR/MR to fund Access.

## Access Entitlement Ledger

Append-only domain subledger in `packages/access-economy/src/funding-solvency/entitlement-ledger.ts`.

Entry types: `ALLOCATION`, `RESERVATION`, `RESERVATION_RELEASE`, `REDEMPTION`, `REVERSAL`, `EXPIRATION`, `MANUAL_ADJUSTMENT`.

Balance invariant:

```
allocated - reserved - consumed - expired + released/reversed = remaining
remaining >= 0
```

## Access Funding Pool

`AccessFundingPool` represents real money or committed funding for future provider settlement. Not token balances.

Scopes: global, category, geography, program.

Category policy:
- `STRICT_CATEGORY` — Lodging cannot spend Mobility funds
- `SHARED_POOL` — future cross-category policy (data model only)

## Funding sources

| Type | Value kind |
|------|------------|
| TREASURY, SUBSCRIPTION, COMMISSION, SPONSOR, EMPLOYER, GOVERNMENT_PROGRAM, PROMOTIONAL_BUDGET, OTHER | `CASH_FUNDED` |
| PROVIDER_DISCOUNT | `DISCOUNT_CAPACITY` (not unrestricted cash) |

Expired sources are excluded from available funding. Historical records are never deleted.

## Access Funding Ledger

Append-only domain subledger for fiat movements. Does not call `Ledger.postJournal`.

Entry types: `FUNDING_RECEIVED`, `FUNDING_COMMITTED`, `FUNDING_RELEASED`, `SETTLEMENT_RESERVED`, `SETTLEMENT_RELEASED`, `SETTLEMENT_CAPTURED`, `REFUND_RECEIVED`, `RESERVE_ALLOCATED`, `RESERVE_RELEASED`, `ADJUSTMENT`.

Balance model (bigint minor units):

```
availableCashFunding =
  cashReceived - pendingSettlement - capturedSettlement - refundReserve - riskReserve

availableFunding = availableCashFunding + availableDiscountCapacity
```

## Solvency equation

```
FundedAccessPool =
  TreasuryFunding + SubscriptionFunding + ProviderDiscountFunding +
  RealizedCommissions + SponsorFunding + EmployerFunding + GovernmentFunding
  - PendingSettlements - CapturedSettlements - RefundReserve - RiskReserve
```

Derived from ledger balances, not hard-coded values. Available funding must never become negative for successful reservations.

## Reservations

### Funding reservations

`AccessFundingReservation` holds fiat before provider settlement. Statuses: `PENDING`, `RESERVED`, `RELEASED`, `CONSUMED`, `EXPIRED`, `FAILED`.

Atomic pool-level locking prevents oversubscription. Abandoned checkouts expire and release funds.

### Entitlement reservations

`AccessEntitlementReservation` holds Access units before redemption. Same atomic locking pattern per entitlement.

Both constraints must be satisfied at redemption (Prompt 34 quote engine).

## Funded capacity

`FundedCapacityState`: `FUNDED`, `PARTIALLY_FUNDED`, `PROVIDER_CONTRIBUTED`, `UNFUNDED`.

Distinguishes allocation rights from currently payable provider coverage. No fake dollar value assigned to Access units globally.

## AccessSolvencyService

Methods: `getFundingPoolBalance`, `getAvailableFunding`, `canReserveFunding`, `reserveFunding`, `releaseFunding`, `consumeFunding`, `getCoverageCapacity`, `getSolvencyStatus`.

Solvency states: `HEALTHY`, `LIMITED`, `EXHAUSTED`, `SUSPENDED`.

## Evidence and idempotency

Every ledger entry carries an `evidenceReference`. Idempotency keys prevent double reservation, release, or consume.

## Canonical ledger relationship

```
AccessFundingLedger  →  (future) Canonical Financial Ledger via Kernel + Execution Authority
AccessEntitlementLedger  →  domain-only; never posts journals
```

Access funding accounting is auditable and reconcilable without duplicating canonical balances.

## Package location

`packages/access-economy/src/funding-solvency/`
