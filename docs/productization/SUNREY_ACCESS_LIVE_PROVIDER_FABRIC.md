# SunRey Access Live Provider Fabric

Internal Alpha server-side integration layer for read-only external Access data.

## Architecture

```
External APIs → Live Provider Adapters → LiveProviderCapabilityRegistry
  → AccessLiveProviderFabricService → AccessProviderNetworkService
  → HumanAccessEconomyProduct → Consumer BFF (/api/v1/access/*) → app.sunrey.xyz
```

No browser calls to third-party APIs. No real-money transactions. `ENVIRONMENT=simulation` remains enforced.

## Provider matrix

| Provider | Category | API | Auth | Classification | Read | Transaction | Cache TTL | State without key |
|---|---|---|---|---|---|---|---|---|
| vast-ai | COMPUTE | `POST https://console.vast.ai/api/v0/bundles/` | `VAST_API_KEY` Bearer | FREE_API_KEY_REQUIRED | yes | no | 45s | CONFIGURATION_REQUIRED |
| ticketmaster | EXPERIENCES | Ticketmaster Discovery v2 | `TICKETMASTER_API_KEY` | FREE_API_KEY_REQUIRED | yes | no | 10m | CONFIGURATION_REQUIRED |
| eia | ENERGY | EIA API v2 | `EIA_API_KEY` | FREE_API_KEY_REQUIRED | yes (reference) | no | 1h | CONFIGURATION_REQUIRED |
| open-charge-map | ENERGY/MOBILITY | Open Charge Map v3 | optional `OPEN_CHARGE_MAP_API_KEY` | FREE_PUBLIC | yes | no | 10m | LIVE_READ |
| ebay | GOODS | eBay Browse API | OAuth `EBAY_CLIENT_ID`/`SECRET` | FREE_API_KEY_REQUIRED | yes | no | 3m | CONFIGURATION_REQUIRED |
| google-places | FOOD/SERVICES/... | Google Places API | `GOOGLE_PLACES_API_KEY` | FREE_USAGE_TIER | optional | no | 15m | NOT_CONFIGURED (disabled) |
| yelp | FOOD/SERVICES | Yelp Fusion | `YELP_API_KEY` | TRIAL_OR_PAID | optional | no | 15m | NOT_CONFIGURED (disabled) |
| frankfurter | reference | Frankfurter FX | none | FREE_PUBLIC | yes | no | 30m | LIVE_READ |
| world-bank | reference | World Bank API | none | FREE_PUBLIC | yes | no | 1h | LIVE_READ |

### Partner-gated (directory only)

| Provider | State |
|---|---|
| Expedia | SANDBOX_AVAILABLE |
| Turo | PARTNER_APPROVAL_REQUIRED |
| DoorDash | PARTNER_APPROVAL_REQUIRED |
| Amazon | PARTNER_APPROVAL_REQUIRED |
| Airbnb | PARTNER_APPROVAL_REQUIRED |

## Environment variables

See `.env.example` and `infra/sandbox/env.example`.

## Consumer BFF endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/access` | GET | Aggregated home feed (`sunrey.consumer.access.home.v2`) |
| `/api/v1/access?simulation=true` | GET | Legacy dashboard stub |
| `/api/v1/access/categories` | GET | Category metadata |
| `/api/v1/access/providers` | GET | Provider directory |
| `/api/v1/access/providers/:providerId` | GET | Provider detail/health |
| `/api/v1/access/providers/:providerId/health` | GET | Provider health |
| `/api/v1/access/offers` | GET | Live offer search |
| `/api/v1/access/search` | GET/POST | Live search (`POST` with `liveSearch: true`) |
| `/api/v1/access/availability` | POST | Availability (existing) |
| `/api/v1/access/recommendations` | GET | Featured live offers |
| `/api/v1/access/provider-status` | GET | Provider status matrix |

## Provenance

Every offer includes:

- `providerId`, `providerRecordId`, `providerUrl`
- `retrievedAt`, `sourceTimestamp`, `cacheAgeSeconds`
- `liveRead`, `simulation`, `stale`

## Smoke test

```bash
RUN_LIVE_PROVIDER_SMOKE_TESTS=true npx tsx scripts/smoke-access-live-providers.ts
```

## Known limitations

- Alpha is read-only; no booking, checkout, GPU rental, or ticket purchase.
- Google Places and Yelp are optional and disabled by default.
- Reference providers (FRED, BLS, IMF, etc.) are economic context only — not Access vendors.
- CI uses mocked HTTP transports; live network is opt-in only.
