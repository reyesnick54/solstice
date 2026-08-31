# Access Product Experience (Wave 4)

Consumer-facing Access productization extends the Prompt 38 Consumer BFF with authoritative backend contracts. The frontend presents truth from SunRey; it does not compute coverage, funding, settlement, or refunds.

## Home Access contract

`GET /api/v1/me/home` includes an `access` resource field (`sunrey.consumer.access.home-summary.v1`):

- **Your Available Access** — category rows with unit counts
- **Next expiration** — earliest entitlement expiry when known
- **Primary CTA** — `Explore Access`
- **Terminology** — canonical labels (`Access covers`, `You pay`, `Remaining Access`)
- **dataState** — `SIMULATED` in simulation; production uses `LIVE` / `UNAVAILABLE` honestly

Dedicated endpoint: `GET /api/v1/access/home-summary`

## Access landing contract

`GET /api/v1/access/landing` (`sunrey.consumer.access.landing.v1`):

| Section | Key |
|---------|-----|
| Your Access | `YOUR_ACCESS` |
| Explore | `EXPLORE` |
| Upcoming | `UPCOMING` |
| Recommended | `RECOMMENDED` |
| Recent Activity | `RECENT_ACTIVITY` |

Category cards expose only enabled configuration categories with explicit `SIMULATED` / `UNAVAILABLE` state.

## Checkout experience

`GET /api/v1/access/transactions/{id}/checkout` returns:

- Provider display name and service
- **providerPrice**, **accessCoverage**, **userContribution** (minor units, backend-authoritative)
- Deposit and deposit warning when applicable
- Quote expiration, cancellation terms
- **requiredActions** — e.g. `ADD_PAYMENT_METHOD`, `CONFIRM_PRICE_CHANGE`
- **fundingAvailable** — honest signal when pool exhaustion blocks redemption

`POST /api/v1/access/transactions/{id}/checkout` starts checkout (idempotent).

## State terminology

| Backend status | User label |
|----------------|------------|
| `PROCESSING_CONFIRMATION` | Confirming booking |
| `BOOKING_CONFIRMED` | Booking confirmed |
| `QUOTE_EXPIRED` | Quote expired |
| `PRICE_CHANGED` | Price changed |
| `FAILED` | Transaction failed |

## Price change

`PRICE_CHANGED` returns `sunrey.consumer.access.price-changed.v1` with previous/new totals. User contribution increases require `CONFIRM_PRICE_CHANGE`.

## Quote expiry

Expired quotes return `QUOTE_EXPIRED` with `REQUOTE` action. Frontend must not reuse stale checkout quotes.

## Booking processing

`PROCESSING_CONFIRMATION` / `RECONCILIATION_REQUIRED` show **Confirming booking**. Purchase is blocked (`purchaseBlocked: true`) until reconciliation resolves.

## User action types

`ADD_PAYMENT_METHOD`, `CONFIRM_PRICE_CHANGE`, `RETRY_USER_PAYMENT`, `CONTACT_SUPPORT`, `REVIEW_CANCELLATION`, `VERIFY_IDENTITY`, `REQUOTE`

## Provider outage

Entitlements and history remain visible. Category-specific discovery/booking degrades with `ACCESS_PROVIDER_TEMPORARILY_UNAVAILABLE` events. No fabricated inventory.

## Funding exhaustion

Entitlements are never deleted. When funding is exhausted, `fundingAvailable: false` blocks checkout with message: funded redemption temporarily unavailable.

## Owner

`packages/human-access-economy/src/product/` — extends Prompt 38 BFF; does not duplicate ledger, Kernel, or provider SDK.
