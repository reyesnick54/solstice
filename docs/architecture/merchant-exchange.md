# Merchant Exchange — Verified Purchase Intent Marketplace

Canonical owner: `packages/sunrey-exchange/src/merchant-exchange/`

Capability: `sunrey-exchange-merchant-commerce` (simulation)

This is **not** a generic auction system, a financial asset exchange, or an
information-rights marketplace. It is a purchase-intent marketplace where
verified user demand meets competing merchant offers.

## Economic flow

```
Purchase Intent
       ↓
Verification
       ↓
Merchant Matching
       ↓
Offer Market (sealed)
       ↓
Comparison / Ranking
       ↓
User Acceptance (explicit)
       ↓
Authorization
       ↓
Payment
       ↓
Fulfillment
       ↓
Settlement
       ↓
Economic Attribution
```

## Distinctions

| System | Purpose |
|--------|---------|
| **Merchant Exchange** | User purchase intent → merchant offers → user selection → purchase |
| **SunRey Exchange** (`packages/sunrey-exchange`) | Financial asset / capacity trading, batch auctions |
| **Information marketplace** (`packages/information-market`) | Data usage rights licensing |
| **Machine commerce** (`packages/sunrey-chain/src/machine-economy`) | M2M bilateral commerce with escrow |
| **Card acceptance** (`packages/cards/src/acceptance`) | Merchant SoftPOS payment acceptance |

## PurchaseIntent

Required criteria (binding):
- category, productOrService, quantity, currency

Preferences (non-binding):
- delivery speed, warranty minimum, brand preferences, eco-friendly, local merchant

Privacy: raw user profile data is never embedded. Merchants receive
`MerchantVisibleIntent` via `toMerchantVisibleIntent()`.

## Intent state machine

`DRAFT → SUBMITTED → VERIFIED → MATCHING → OPEN_FOR_OFFERS →
OFFER_SELECTION → AUTHORIZED → FULFILLMENT → SETTLED`

Terminal: `CANCELLED`, `EXPIRED`, `FAILED`

## Sealed offer principle

- Merchants see **only their own offers** plus aggregate competitor count
- Merchants do **not** see competitor prices or identities
- Users see all normalized/ranked offers for comparison
- No automatic offer acceptance — user must explicitly select

## Offer immutability

Offers are content-hashed at submission. The accepted snapshot is frozen
at selection. Material changes require a new offer version and new
user authorization.

## Payment authorization boundary

```
offer accepted → payment/action proposal → user authorization
→ approved provider/payment rail → result
```

The Merchant Exchange does **not** hold unrestricted payment authority.
When no payment provider is live, purchase stays `PAYMENT_UNAVAILABLE`.

## Settlement boundary

Offer acceptance ≠ settlement complete. Settlement requires:
1. Confirmed payment (`paymentReference`)
2. Completed fulfillment (`DELIVERED` or `COMPLETED`)

## Economic attribution

Connects to existing systems without inventing token amounts:
- **HIN**: not eligible (merchant purchase ≠ HIN contribution)
- **Access Economy**: eligible when offer references access entitlement
- **MoonRey**: not eligible (no mint)
- **Reward credit**: eligible when offer references reward credit at owning port

## Merchant eligibility

- Active status
- Provider-verified KYB (`PROVIDER_VERIFIED`)
- Supported category and geography
- Compliance not restricted
- Offer permissions

Missing live KYB provider is represented honestly — unverified merchants
cannot submit offers.

## Abuse controls

- User intent rate limits
- Merchant offer rate limits
- Duplicate offer prevention (1 per merchant per intent)
- Self-dealing prevention
- Withdraw/repost limits

## API

BFF routes at `services/api/src/consumer/merchant-exchange.ts`:

| Route | Role | Action |
|-------|------|--------|
| `POST /api/v1/merchant-exchange/intents` | USER | Create purchase intent |
| `GET /api/v1/merchant-exchange/intents/{id}` | USER | View intent |
| `GET /api/v1/merchant-exchange/intents/{id}/offers` | USER | View ranked offers |
| `POST /api/v1/merchant-exchange/intents/{id}/select` | USER | Select offer |
| `POST /api/v1/merchant-exchange/offers` | MERCHANT | Submit offer |
| `POST /api/v1/merchant-exchange/offers/{id}/withdraw` | MERCHANT | Withdraw offer |
| `GET /api/v1/merchant-exchange/merchant/{id}/intents/{id}/offers` | MERCHANT | Sealed own offers |
| `POST /api/v1/merchant-exchange/purchases/{id}/authorize` | USER | Authorize purchase |
| `GET /api/v1/merchant-exchange/purchases/{id}` | USER | View fulfillment/settlement |

## Build status components

| Component | Status |
|-----------|--------|
| Merchant Exchange engine | IMPLEMENTED (simulation) |
| Merchant onboarding/KYB | DEPENDENCY — uses identity verification state |
| Live merchant supply | NOT_CONNECTED |
| Payment execution | SIMULATION_ONLY — provider port |
| Fulfillment integration | SIMULATION_ONLY — state machine |

## Tests

- `packages/sunrey-exchange/src/merchant-exchange/merchant-exchange.test.ts`
- `tests/wave-5-prompt-14-merchant-exchange.test.ts`
- `services/api/src/consumer-merchant-exchange.test.ts`
