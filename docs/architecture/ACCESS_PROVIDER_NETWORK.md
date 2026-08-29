# SunRey Access Provider Network — ACCESS-14

Classification: engineering simulation on current `main`.

## Overview

ACCESS-14 adds the next Human Access Economy layer:

1. **SunRey Access Network** — provider integration abstraction in `packages/access-economy/src/providers/`
2. **Access Provider Gateway** — canonical discovery, availability, quote, reservation, booking, cancellation
3. **Access Redemption Engine** — converts governed entitlements into redeemable economic benefit against provider capacity
4. **Consumer product contract** — backend DTOs for the **Access** product surface (`Your Access`, `Redeem Access`)

Production posture is unchanged:

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
LIVE_CONNECTIVITY_ENABLED=false
PRODUCTION_ACTIVE=false
LIVE_PROVIDER_CONNECTIVITY=false
```

## Canonical ownership

| Component | Owner |
| --- | --- |
| Provider gateway types + adapters | `packages/access-economy/src/providers/` |
| Redemption engine + workflow | `packages/access-economy/src/providers/redemption/` |
| Coverage policy | `packages/access-economy/src/providers/coverage-policy.ts` |
| Funding router (intent port) | `packages/access-economy/src/providers/funding-router.ts` |
| Consumer orchestration | `packages/human-access-economy/src/provider-network.ts` |
| BFF routes | `services/api/src/consumer/access.ts` |

Financial authorities remain canonical: Ledger, payments, custody, Kernel, Exchange, Chain.

## Architecture

```
Consumer BFF (/api/v1/access/*)
  → human-access-economy (product façade)
  → Access Provider Gateway (provider-neutral quotes/bookings)
  → Redemption Engine (coverage + entitlement hold)
  → Funding Router (settlement intents → payments/custody/access-fabric)
  → Simulation provider adapters (Expedia, Turo, DoorDash, Amazon, Airbnb)
```

The entitlement is **not** money. Coverage amounts are internal settlement economics only.

## Provider adapters (simulation)

| Provider | Contract state | Integration mode |
| --- | --- | --- |
| Expedia | `SimulationExpediaProvider` | `SIMULATED` |
| Turo | `SimulationTuroProvider` | `PARTNER_APPROVAL_REQUIRED` (simulation only in this chunk) |
| DoorDash | `SimulationDoorDashProvider` | `PARTNER_APPROVAL_REQUIRED`; marketplace ordering not assumed |
| Amazon | `SimulationAmazonProvider` | `PARTNER_APPROVAL_REQUIRED`; ownership vs delivery distinguished |
| Airbnb | `SimulationAirbnbProvider` | `PARTNER_APPROVAL_REQUIRED` |

No live API calls. No secrets in source.

## Coverage policy

Versioned policies in `coverage-policy.ts`:

- `MOBILITY_STANDARD` — up to 110 USD equivalent per qualifying vehicle-day
- `STAY_STANDARD` — up to 180 USD equivalent per qualifying room-night
- `FOOD_STANDARD` — up to 28 USD equivalent per qualifying meal
- `GOODS_STANDARD` — up to 40 USD equivalent per qualifying delivery item

## Funding router

Creates intents toward:

- `ACCESS_ENTITLEMENT` → `packages/access-fabric`
- `FIAT` → `packages/payments`
- `SUNREY_COIN` / `MOONREY_COIN` → `packages/custody`
- `REWARD_CREDIT` → `packages/access-fabric`

Does not post balances.

## Redemption workflow

Canonical saga stages:

1. Provider search / availability / quote
2. Entitlement evaluation + coverage decision
3. Entitlement hold
4. User approval (when contribution required)
5. Funding intent emission
6. Provider reservation + booking
7. AccessRight / DeliveryRight / OwnershipPurchase outcome
8. Entitlement consume or release on failure

Bundle failure policies: `ALL_OR_NOTHING`, `PARTIAL_WITH_APPROVAL`, `BEST_EFFORT`.

## Frontend contract

| Route | Purpose |
| --- | --- |
| `GET /api/v1/access/overview` | Your Access home (`navigationLabel: Access`) |
| `GET /api/v1/access/providers` | Provider registry |
| `POST /api/v1/access/search` | Provider catalog search |
| `POST /api/v1/access/quotes` | Provider or legacy fixture quote |
| `POST /api/v1/access/redemptions/preview` | Coverage preview |
| `POST /api/v1/access/redemptions` | Start redemption |
| `POST /api/v1/access/redemptions/:id/confirm` | Confirm redemption |
| `POST /api/v1/access/redemptions/:id/cancel` | Cancel redemption |
| `GET /api/v1/access/redemptions/:id` | Redemption status |

## Provider onboarding flow

1. Provider contract signed
2. Provider capability declaration
3. API credentials provisioned (secret infrastructure)
4. Sandbox qualification
5. Catalog/capacity mapping
6. Price normalization
7. Reservation validation
8. Webhook verification
9. Refund/cancellation validation
10. Security review
11. Regulatory capability review
12. Production approval
13. `LIVE_ENABLED`

A provider never becomes live merely because an adapter compiles.

## Security model

- Credentials via `ProviderCredentialPort` (no hard-coded secrets)
- Webhook signature verification interface
- Rate limiting, retry, circuit breaker, timeout policies
- Simulation webhooks explicitly labeled `simulationOnly: true`
- Idempotent webhook replay protection

## ACCESS-14 invariants

See `packages/access-economy/src/providers/redemption/invariants.ts` for the permanent invariant set including:

- `ENTITLEMENT_IS_NOT_CASH`
- `NO_REDEMPTION_WITHOUT_PROVIDER_QUOTE_OR_APPROVED_INTERNAL_CAPACITY`
- `NO_LIVE_PROVIDER_WITHOUT_CAPABILITY_GATE`
- `OWNERSHIP_PURCHASE_IS_NOT_ACCESS_RIGHT`

## Test surface

| Suite | Location |
| --- | --- |
| Provider gateway + redemption E2E | `packages/access-economy/src/providers/access-14-e2e.test.ts` |
| Consumer BFF integration | `tests/access-14-provider-network.test.ts` |
| Consumer BFF regression | `services/api/src/consumer-access.test.ts` |
