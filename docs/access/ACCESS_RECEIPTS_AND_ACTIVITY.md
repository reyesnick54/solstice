# Access Receipts and Activity

## Receipt model

`AccessReceipt` (`sunrey.consumer.access.receipt.v1`):

| Field | Description |
|-------|-------------|
| `receiptId` | Immutable receipt identifier |
| `accessTransactionId` | Linked transaction |
| `providerDisplayName` | User-safe provider label |
| `serviceName` | Service description |
| `financial.providerTotal` | Provider price (minor units) |
| `financial.accessCoverage` | Access covers amount |
| `financial.userContribution` | You pay amount |
| `financial.depositAmount` | Separate deposit when applicable |
| `access.unitsUsed` | Access consumed |
| `access.entitlementBefore` / `entitlementAfter` | Entitlement snapshot |
| `booking.confirmationReference` | Provider confirmation (no secrets) |
| `immutable` | Always `true` |

## Receipt types

- **BOOKING_CONFIRMATION** — generated at `BOOKING_CONFIRMED`
- **SETTLEMENT** — generated at `FULFILLED`
- **REFUND** — via `AccessRefundReceipt`

## Immutability

Original purchase receipts are never rewritten. Refunds create linked `AccessRefundReceipt` records with:

- `returnedToUser`, `returnedToAccessPool`, `penaltyAmount`
- `entitlementRestored` / `entitlementNotRestored`
- Reference to `originalReceiptId`

## API

- `GET /api/v1/access/receipts`
- `GET /api/v1/access/receipts/{id}`
- `GET /api/v1/access/refund-receipts/{id}`

## Activity model

`AccessActivityItem` types: `ALLOCATION`, `RESERVATION`, `BOOKING`, `FULFILLMENT`, `CANCELLATION`, `REFUND`, `EXPIRATION`, `RESTORATION`

Activity copy is product-safe — not raw ledger entries.

## History API

`GET /api/v1/access/history`

Filters: `ALL`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `REFUNDED`

Query params: `category`, `from`, `to`

## Upcoming API

`GET /api/v1/access/upcoming` — booked services with status, action required, cancellation deadline, deposit warning.
