# ACCESS Fiat Settlement Orchestration

**Chunk:** ACCESS-35  
**Schema:** `sunrey.access.settlement-orchestration.v1`  
**Owner:** `packages/access-economy/src/settlement`

This document describes the canonical fiat settlement orchestration layer that allows a SunRey Access transaction to pay an Access Provider in conventional fiat — without requiring providers to accept SunRey Coin (SR) or MoonRey Coin (MR) at launch.

## Settlement equation

At launch, provider settlement is funded entirely from fiat sources:

```
ProviderSettlementAmount
  = AccessPoolContribution
  + UserFiatContribution
  + TokenConversionContribution
  + OtherExplicitProgramContribution
```

**Launch constraint:** `TokenConversionContribution = 0`. No SR sale, MR sale, burn, or transfer occurs during settlement.

**Example:**

| Source | Amount |
|--------|--------|
| Provider requires | $400 |
| Access Pool | $300 |
| User fiat | $100 |
| Token conversion | $0 |
| **Provider receives** | **$400** |

The equation is validated with exact bigint minor-unit equality before any reservation or authorization.

## Access / user split

`AccessSettlementPlan` preserves the split from the checkout quote:

- `accessPoolContribution` — reserved atomically from `AccessFundingReservationStore`
- `userContribution` — authorized through the canonical user funding port
- `tokenConversionContribution` — enforced zero at launch
- `otherProgramContribution` — explicit additional program fiat (zero by default)

`AccessSettlementSourceOfFunds` is stored on every settlement record and never collapsed. This supports refunds, audit, treasury reporting, and consumer receipts.

## Provider-facing payment

The provider sees a normal fiat settlement for the full `providerAmount`. The provider does not see:

- Access subsidy breakdown
- SR or MR balances
- Participant weight or allocation policy

Provider payment is executed through the selected `AccessPaymentRail`. The rail receives `providerFacingAmount = providerAmount`.

## Payment rail abstraction

`AccessPaymentRail` is the provider-agnostic contract:

| Method | Purpose |
|--------|---------|
| `authorize` | Hold provider payment obligation |
| `capture` | Finalize provider payment |
| `void` | Release authorization |
| `refund` / partial | Return provider funds |
| `getPaymentStatus` | Query remote state |
| `reconcile` | Resolve unknown state |

### Rail kinds (future)

`VIRTUAL_CARD`, `DIRECT_PROVIDER_API`, `BANK_TRANSFER`, `ACH`, `INVOICE`, `WALLET`, `PROVIDER_CREDIT`, `SIMULATED`

### Capabilities

Rails declare supported capabilities: `AUTHORIZE`, `CAPTURE`, `VOID`, `REFUND`, `PARTIAL_REFUND`, `STATUS`, `RECONCILE`, `RESTRICTED_CARD`, `PAYOUT`.

A rail implements only what it supports. Prompt 36 will implement the restricted virtual card rail.

## Authorization and capture

Where the rail supports it, settlement prefers **authorize then capture** around the provider booking lifecycle:

1. Reserve entitlement units
2. Reserve Access Pool funding
3. Compliance / risk approval
4. Authorize user contribution (if any)
5. Authorize provider payment
6. Capture after fulfillment policy allows

Capture does not occur irreversibly before fulfillment state is known unless the provider strategy requires it.

## Settlement strategies

Configurable per provider / commercial integration:

| Strategy | Description |
|----------|-------------|
| `AUTHORIZE_THEN_BOOK_THEN_CAPTURE` | Auth → book → capture on fulfillment |
| `RESERVE_BOOK_CAPTURE` | Reserve all holds, book, capture |
| `BOOK_THEN_PAY` | Provider booking before payment |
| `PAY_THEN_BOOK` | Payment before provider booking |
| `INVOICE_AFTER_FULFILLMENT` | Invoice settlement post-fulfillment |

The orchestrator reads `settlementStrategy` from the plan; ordering is strategy-driven.

## Idempotency

All settlement operations require idempotency keys scoped as:

```
{settlementId}:{operation}:{clientIdempotencyKey}
```

Repeated `authorize`, `capture`, `void`, and `refund` calls return the prior result without duplicate money movement. Provider rails use derived keys per existing payment conventions.

## Unknown-state handling

If a payment provider times out after an authorization request:

1. **Do not** blindly retry authorization
2. Mark settlement `RECONCILIATION_REQUIRED`
3. Call `reconcile()` with the payment reference and idempotency key
4. Resolve to `AUTHORIZED`, `FAILED`, or remain `RECONCILIATION_REQUIRED`

Unknown remote state blocks void and compensation until reconciled.

## Ledger integration

`AccessSettlement` records business context. The **canonical fiat ledger** remains authoritative for actual monetary state.

```
AccessSettlement (domain)
       ↓
CanonicalFiatLedgerPort.postSettlementCapture
       ↓
Ledger.postJournal (via human-access-economy orchestration with Execution Authority)
```

`AccessFundingLedger` tracks program funding capacity. Canonical ledger tracks customer and settlement cash. Both reconcile via evidence references.

`access-economy` does not import `packages/ledger`, `packages/kernel`, or `packages/payments`. Wiring happens in `packages/human-access-economy` or `services/` via injected ports.

## Refund source mapping

Refunds preserve the original source-of-funds split using proportional allocation:

| Original | Full $400 refund |
|----------|------------------|
| Access Pool $300 | $300 → Access funding |
| User $100 | $100 → user funding source |

Partial refunds use deterministic proportional split — never silently crediting one side. Prompt 37 finalizes full refund lifecycle behavior.

## Token boundary

At launch:

- `tokenConversionContribution = 0` enforced in `validateSettlementEquation`
- No SR/MR sale, burn, or transfer for settlement
- `LAUNCH_TOKEN_CONVERSION_CONTRIBUTION = 0n`

## Compliance integration

Before settlement execution, `ComplianceGatePort.evaluate()` is called. This port is wired to the existing Compliance Kernel in application orchestration layers. `access-economy` does not create a second Access-specific compliance engine.

Flow:

```
Access request
      ↓
ComplianceGatePort (Kernel in production wiring)
      ↓
Funding + entitlement reservation
      ↓
User + provider authorization
      ↓
Capture on fulfillment
```

## Evidence / audit

The orchestrator seals evidence for:

- Checkout quote
- Funding reservation
- Entitlement reservation
- Compliance decision
- User authorization
- Provider authorization
- Capture / void / refund
- Canonical ledger journal

Sensitive payment data (PAN, CVV, credentials) is never stored or logged.

## Module layout

```
packages/access-economy/src/settlement/
  taxonomy.ts          — statuses, rail kinds, capabilities, strategies
  types.ts             — AccessCheckoutQuote, AccessSettlementPlan, records
  invariants.ts        — settlement equation, refund allocation
  ports.ts             — ComplianceGate, UserFunding, CanonicalFiatLedger
  payment-rail.ts      — AccessPaymentRail contract
  orchestrator.ts      — AccessSettlementOrchestrator
  rails/simulated.ts   — simulation rail and port fixtures
  access-35.test.ts    — acceptance tests
```

## Orchestrator operations

| Operation | Purpose |
|-----------|---------|
| `prepareSettlement` | Validate plan, create PENDING record |
| `reserve` | Entitlement + funding reservations |
| `authorize` | Compliance → user auth → provider auth |
| `capture` | Capture payments, consume reservations, post ledger |
| `void` | Void authorizations, release reservations |
| `refund` / `partialRefund` | Proportional source mapping |
| `getSettlement` | Read settlement state |
| `reconcile` | Resolve RECONCILIATION_REQUIRED |

## Prompt 36 recommendation

Prompt 36 should implement the `VIRTUAL_CARD` payment rail with `RESTRICTED_CARD` and `PAYOUT` capabilities:

1. Extend `AccessPaymentRail` with a `VirtualCardAccessPaymentRail` adapter
2. Wire BaaS sandbox fixtures (no live merchant payment)
3. Support provider-facing card authorization with spend limits scoped to `providerAmount`
4. Integrate with existing `packages/payments` idempotency and webhook normalization
5. Preserve source-of-funds split in card settlement metadata
6. Do not expose subsidy breakdown on the card descriptor presented to merchants

The orchestrator, settlement plan, and port boundaries from Prompt 35 are ready for that rail plug-in.
