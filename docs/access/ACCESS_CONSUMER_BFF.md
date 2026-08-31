# Access Consumer BFF (Prompt 38)

Canonical Consumer BFF contract for the SunRey mobile/web Access product. The frontend talks to SunRey only; external providers remain behind `packages/human-access-economy` and `packages/access-economy`.

## Base path

`/api/v1/access`

All routes require `Authorization: Bearer <session>`. Mutations accept `Idempotency-Key` header or `idempotencyKey` in the JSON body.

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/access` | Dashboard snapshot (`sunrey.consumer.access.dashboard.v1`) |
| GET | `/api/v1/access/overview` | Legacy overview (`sunrey.consumer.access.overview.v1`) |
| GET | `/api/v1/access/home-summary` | Lightweight Home summary |
| GET | `/api/v1/access/entitlements` | List entitlements; filters: `category`, `status`, `period`, `expiringSoon` |
| GET | `/api/v1/access/entitlements/{id}` | Entitlement detail + usage context |
| GET | `/api/v1/access/categories` | Category metadata |
| GET | `/api/v1/access/categories/{category}` | Category detail + user availability |
| POST | `/api/v1/access/search` | Discovery search → `AccessOpportunityView` cards (reference pricing only) |
| GET | `/api/v1/access/opportunities/{id}` | Opportunity detail |
| POST | `/api/v1/access/quote` | Firm checkout quote with coverage breakdown |
| POST | `/api/v1/access/reserve` | Begin transaction from `checkoutQuoteId` (alias: `/checkout`) |
| POST | `/api/v1/access/transactions/{id}/confirm` | Idempotent confirm |
| GET | `/api/v1/access/transactions/{id}` | Consumer-safe transaction status |
| GET | `/api/v1/access/bookings/{id}` | Booking detail |
| POST | `/api/v1/access/transactions/{id}/cancel` | Cancel + refund-pending state |
| GET | `/api/v1/access/history` | Paginated history (`cursor`, `pageSize`) |
| GET | `/api/v1/access/allocation/explanation` | User-safe allocation explanation |

Legacy routes (`/quotes`, `/reservations`, `/redemptions/*`, `/experiences/*`) remain for backward compatibility.

## User-facing states

### Product data (`overallStatus`)

- `SIMULATED` — ENVIRONMENT is simulation; live providers disabled
- `PARTIAL` — partial catalog/coverage
- `STALE` / `UNAVAILABLE` — not ready for consumer use

### Transaction status (sanitized)

`PROCESSING`, `PROCESSING_CONFIRMATION`, `BOOKED`, `CONFIRMED`, `FULFILLED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED`, `ACTION_REQUIRED`, `FAILED`

`RECONCILIATION_REQUIRED` internally maps to `PROCESSING_CONFIRMATION` with message: *"We're confirming this transaction with the provider."*

### Funding / discovery (category summaries)

- `AVAILABLE`, `LIMITED`, `TEMPORARILY_UNAVAILABLE`

Treasury balances and funding ledger internals are never exposed.

## Quote lifecycle

1. **Search** — reference availability only; `priceDisclaimer` clarifies non-firm pricing.
2. **Quote** (`POST /quote`) — firm provider quote + `AccessCoverageEngine` preview via redemption workflow. Returns `checkoutQuoteId`, `breakdown`, `depositWarning`.
3. **Reserve** — server re-validates quote; client cannot submit authoritative coverage amounts.
4. **Confirm** — idempotent; invokes `AccessTransactionOrchestrator` path via provider redemption confirm.

## Security

- Ownership enforced on entitlements, transactions, bookings.
- No `providerId`, API keys, credentials, or treasury balances in consumer responses.
- Payment references use `paymentMethodId` tokens only (Money remains fiat authority).

## Integrations

### Home (`GET /api/v1/me/home`)

Adds `access` `ResourceField` with category highlights, next expiration, active booking, and action-required flag. No provider search on Home.

### Travel (`GET /api/v1/travel/overview`)

Mobility section includes `availableWithAccess.searchPath` and `quotePath` linking into Access.

### Money

User co-pay and refunds reference canonical payment state; Access presents amounts for display only.

## Error mapping

| Domain | Consumer `errorCode` |
|--------|---------------------|
| `SUBJECT_MISMATCH` | `RESOURCE_NOT_OWNED` |
| `NOT_FOUND` | `NOT_FOUND` |
| `FEATURE_DISABLED` | `FEATURE_UNAVAILABLE` |
| `QUOTE_EXPIRED` | `VALIDATION` |
| `PROVIDER_UNAVAILABLE` | `VALIDATION` (safe message) |

## Owner

- BFF dispatch: `services/api/src/consumer/access.ts`
- Product surface: `packages/human-access-economy/src/consumer-bff/`
- OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`
- SDK types: `packages/sunrey-sdk/src/consumer-bff/types.ts`
