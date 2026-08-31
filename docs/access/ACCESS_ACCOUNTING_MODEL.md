# Access Accounting Model

> **Disclaimer:** This document describes software architecture and control points only.
> Final legal, accounting, tax, consumer-protection, and regulatory treatment must be
> reviewed and approved by qualified professionals and applicable regulated partners
> before production launch.

## Liability recognition stages

The software distinguishes these configurable stages. These are **not** GAAP/IFRS conclusions.

| Stage | Code | Economic meaning |
|-------|------|------------------|
| A | `ALLOCATION_CREATED` | Non-cash entitlement recorded |
| B | `FUNDING_RESERVATION_CREATED` | Contingent internal commitment |
| C | `PROVIDER_PAYMENT_AUTHORIZED` | Financial obligation pending |
| D | `PROVIDER_PAYMENT_CAPTURED` | Actual settlement |
| E | `REFUND_PENDING` | Potential receivable/refund state |

## Accounting events

Canonical Access accounting event types:

| Event | Liability stage |
|-------|-----------------|
| `ACCESS_ALLOCATION_CREATED` | A |
| `ACCESS_FUNDING_RECEIVED` | — |
| `ACCESS_FUNDING_RESERVED` | B |
| `ACCESS_FUNDING_RELEASED` | — |
| `ACCESS_PROVIDER_PAYMENT_AUTHORIZED` | C |
| `ACCESS_PROVIDER_PAYMENT_CAPTURED` | D |
| `ACCESS_USER_COPAY_AUTHORIZED` | C |
| `ACCESS_USER_COPAY_CAPTURED` | D |
| `ACCESS_PROVIDER_REFUND_RECEIVED` | E |
| `ACCESS_USER_REFUND_ISSUED` | E |
| `ACCESS_ENTITLEMENT_EXPIRED` | — |
| `ACCESS_ENTITLEMENT_RESTORED` | — |

Access events reference canonical Money events via `canonicalMoneyEventRef` where
equivalent financial events exist. No duplicate ledger postings are created.

Implementation: `packages/access-economy/src/regulatory-controls/accounting-events.ts`

## General ledger mapping foundation

Configurable conceptual account roles (no hard-coded COA numbers):

- Access Program Cash
- Access Settlement Payable
- User Co-Pay Clearing
- Provider Settlement Clearing
- Refund Receivable
- Access Promotional Expense
- Provider Discount Benefit
- Sponsor Funding
- Employer Program Funding
- Government Program Funding
- Subscription Program Funding
- Access Service Fee Revenue

Accountants assign real chart-of-accounts numbers via `AccessGlMappingRegistry`.
All mappings default to `DRAFT` status pending accounting approval.

Implementation: `packages/access-economy/src/regulatory-controls/gl-mapping.ts`

## Funding source classification

| Classification | Restrictions |
|----------------|--------------|
| `CASH_FUNDED` | Unrestricted program cash |
| `DISCOUNT_CAPACITY` | Provider retail discount — **not** unrestricted cash |
| `PROVIDER_CONTRIBUTED_CAPACITY` | Provider-contributed capacity |
| `SPONSOR_FUNDED` | Program/category/geography restricted |
| `EMPLOYER_FUNDED` | Program/category restricted |
| `GOVERNMENT_FUNDED` | Approved geography/category only |
| `PROMOTIONAL_BUDGET` | Promotional spend only |

Provider discount capacity must not be treated as unrestricted cash in treasury
or solvency calculations.

## Subscription funding boundary

If Access is later funded by subscription revenue, it is classified as
`PROGRAM_FUNDING_REVENUE` — not bank deposit or stored value. No subscription
implementation is included in Prompt 40.

## Tax data boundary

Provider-supplied tax values are preserved. Components:

- `PROVIDER_COLLECTED_TAX` (provider-supplied)
- `SUNREY_FEE`
- `USER_FEE`
- `ACCESS_SUBSIDY`

No autonomous tax determination engine is created.

## Mustang scenario reconciliation

Provider total = $400, Access coverage = $300, User contribution = $100:

- Provider settlement = $400
- Access funding consumption = $300
- User contribution = $100
- Token contribution = $0

Full refund restores all components subject to configured policies.

Implementation: `packages/access-economy/src/regulatory-controls/accounting-scenarios.ts`

## Partial refund (75/25 policy)

Provider refund = $200 on original $300 Access + $100 user:

- Access funding restoration = $150
- User refund = $50

Proportional split is configurable; default test policy uses 75/25.
