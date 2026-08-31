# Access Regulatory Boundaries

> **Disclaimer:** This document describes software architecture and control points only.
> Final legal, accounting, tax, consumer-protection, and regulatory treatment must be
> reviewed and approved by qualified professionals and applicable regulated partners
> before production launch.

## Economic classification

Access entitlements are classified as **`NON_CASH_ACCESS_RIGHT`**.

Access is explicitly **not**:

- `BANK_DEPOSIT`
- `CASH_BALANCE`
- `STABLECOIN`
- `TOKEN_REDEMPTION`
- `GUARANTEED_FIAT_VALUE`
- `UNCONDITIONAL_PROVIDER_CLAIM`

Implementation: `packages/access-economy/src/regulatory-controls/economic-classification.ts`

## Launch model

```
SR/MR ownership
      ↓
Access allocation eligibility
      ↓
Non-cash Access entitlement
      ↓
Funded Access coverage + User fiat contribution
      ↓
Provider receives fiat
```

At launch:

- `TokenConversionContribution = 0`
- Access providers do **not** need to accept SR or MR
- No canonical rule such as `1 SR = $X Access` or `1 MR = $X Access`

## Three separate economic states

| State | Type | Owner |
|-------|------|-------|
| Token holdings | SR/MR custody/chain | Canonical custody + chain |
| Access units | `AccessUnitQuantity` (branded bigint) | Access entitlement ledger |
| Fiat funding | Minor units in funding pools | Access funding ledger |

Strong typing prevents `AccessUnitQuantity + Money` without an explicit
`AccessCoverageValuationContext`.

## Token separation

SR/MR holdings influence **allocation eligibility** only. They do **not** establish:

- Guaranteed redemption
- Fixed Access value
- Merchant payment obligation
- Automatic fiat liability
- Settlement amount

## Coverage promise boundary

A user may hold entitlement units (e.g. 3 Mobility Days) while funded redemption
availability is `LIMITED`. These are distinct states and must not be conflated in
consumer surfaces.

## Compliance authority

External provider data flows through evidence/transaction context to the **Compliance
Kernel**. Access provider adapters must not make independent compliance decisions.

Implementation: `packages/access-economy/src/regulatory-controls/compliance-integration.ts`

## Production gates

| Gate | Purpose |
|------|---------|
| Provider contract gate | Blocks production booking through sandbox/unsigned/terminated providers |
| Payment provider gate | Blocks sandbox card rails outside simulation |
| Jurisdiction policy | Configurable dimensions for legal/compliance approval |

## Canonical authority map

| Capability | Canonical owner |
|------------|-----------------|
| Money ledger | `packages/ledger` via Kernel + Execution Authority |
| Access entitlements | `packages/access-economy` entitlement ledger |
| Access funding | `packages/access-economy` funding ledger |
| Compliance decisions | `packages/kernel` |
| Settlement clearing | `packages/sunrey-exchange` access-fabric |

Access subledgers reconcile to canonical financial events via evidence references.
They do not replace the canonical ledger.
