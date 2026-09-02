# SunRey Consumer API Reference

**API version:** `v1`  
**Contract version:** `1.0.0-wave8`  
**Environment:** simulation only  
**Base URL:** `/api/v1`

> Production-capable endpoints are marked **SIMULATION** until governance ceremony authorizes live connectivity. No endpoint in this document activates production economics.

---

## Authentication

All consumer routes except `/health`, `/ready`, `/api/v1/version`, and catalog routes require:

```
Authorization: Bearer <session-token>
```

Server resolves identity from the session store. Do not send `X-User-Id` or other self-asserted identity headers.

---

## Response headers

| Header | Value |
|--------|-------|
| `x-sunrey-api-version` | `v1` |
| `x-sunrey-contract-version` | `1.0.0-wave8` |
| `x-sunrey-environment` | `simulation` |
| `Deprecation` | `true` (deprecated routes only) |
| `Sunset` | ISO date (deprecated routes only) |

---

## Catalog

### `GET /api/v1/catalog/contract`

Returns contract manifest, domains, and deprecation list.

### `GET /api/v1/catalog/domains`

Returns API domain catalog with classification (`LIVE` | `SANDBOX` | `SIMULATION` | `PARTIAL` | `LEGACY` | `UNUSED`).

### `GET /api/v1/catalog/status-semantics`

Returns `blockchainTxStatus` and `economicClaimStatus` enum arrays.

---

## Home — SIMULATION

### `GET /api/v1/me/home`

Aggregated home read model. Balances from ledger reads only.

### `GET /api/v1/me/bootstrap`

Bootstrap bundle for app startup.

### `GET /api/v1/me/capabilities`

Feature capability map with `SIMULATION_ONLY` states.

---

## Money — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/accounts` | Account list |
| GET | `/accounts/{id}` | Account detail |
| GET | `/accounts/{id}/activity` | Cursor-paginated activity |
| GET | `/payments` | Payment list |
| POST | `/payments` | Create payment (idempotency required) |
| GET | `/fx/valuation` | FX valuation |

**Regulated-disabled for live rails.** `productionMoneyMovement: false` on all responses.

---

## Wallet — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/wallets` | Wallet list |
| GET | `/wallets/deposit-address` | Deposit address |
| POST | `/wallets/withdrawals` | Withdrawal (requires verification) |

Blockchain finality uses: `SUBMITTED`, `PENDING`, `INCLUDED`, `EXECUTED`, `FINALIZED`, `REJECTED`.

---

## Grow — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/grow` | Grow home |
| GET | `/grow/portfolio` | Portfolio (canonical) |
| GET | `/grow/goals` | Goals |
| POST | `/grow/proposals` | Create proposal (no execution) |

Deprecated: `GET /portfolio`, `GET /goals` → use `/grow/*` paths.

---

## Vault — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/data/vault` | Vault home |
| GET | `/data/vault/records` | Record list |
| GET | `/data/vault/records/{id}` | Record detail |

Requires `VAULT_VIEW_OWN` capability.

---

## Exchange — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/exchange` | Exchange home |
| GET | `/exchange/markets` | Markets |
| GET | `/exchange/stream` | SSE market updates |
| POST | `/exchange/orders` | Submit order (proposal flow) |

Not a second ledger. Last trade is `LAST_TRADE_NOT_GUARANTEED`.

---

## SunRey — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/sunrey/balance` | User SunRey balance |
| GET | `/sunrey/supply` | Protocol supply |
| GET | `/sunrey/contributions/status` | Contribution status |
| GET | `/sunrey/contributions/history` | Verified history (sanitized) |
| GET | `/sunrey/peve` | PEVE summary (verified users only) |
| GET | `/sunrey/receipts` | Issuance receipts |
| GET | `/sunrey/network-status` | Chain status |

All responses include `valuationDoesNotSetPrice: true` where applicable.  
Deprecated: `GET /economy/sunrey-coin`.

---

## MoonRey — SIMULATION

| Method | Path | Notes |
|--------|------|-------|
| GET | `/moonrey/balance` | User MoonRey balance |
| GET | `/moonrey/supply` | Protocol supply |
| GET | `/moonrey/categories` | Productive categories |
| GET | `/moonrey/indicators` | Productive indicators |
| GET | `/moonrey/gpuv` | GPUV (not market price) |
| GET | `/moonrey/claims` | Productive claims |
| GET | `/moonrey/receipts` | Economic receipts |
| GET | `/moonrey/providers` | Provider status |

GPUV responses always include:
- `gpuvIsNotMarketPrice: true`
- `gpuvIsNotMoonReyQuantity: true`
- `gpuvIsNotExchangePrice: true`

Deprecated: `GET /economy/moonrey-coin`, `GET /economy/productive`.

---

## Action Center — SIMULATION

### `GET /api/v1/actions`

Unified action list from durable backend state.

Query: `view` — `AWAITING_APPROVAL` | `PROCESSING` | `COMPLETED` | `REJECTED` | `EXPIRED` | `REQUIRES_ATTENTION` | `ALL`

### `GET /api/v1/actions/stream`

SSE stream of Action Center events. Set `Accept: text/event-stream`.

Deprecated: `GET /me/actions`.

---

## Realtime — SIMULATION

### `GET /api/v1/events/stream`

Multiplexed product event stream (SSE).

Event kinds: `TRANSACTION_FINALITY`, `BALANCE_CHANGE`, `CLAIM_STATUS`, `ACTION_CENTER`, `EXCHANGE_UPDATE`, `PROVIDER_STATUS`.

---

## Error envelope

```json
{
  "errorCode": "POLICY_DENIED",
  "category": "POLICY",
  "message": "account restriction forbids this action",
  "retryable": false,
  "detailsSafeForClient": { "code": "POLICY_DENIED" },
  "requestId": "req_...",
  "apiVersion": "v1"
}
```

---

## SDK

Typed client: `packages/sunrey-sdk` → `createSunReyConsumerBffClient()`.

Shared types: `packages/sunrey-sdk/src/consumer-bff/types.ts`.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **SIMULATION** | Fully productized; simulation data only |
| **SANDBOX** | Sandbox/fixture provider data |
| **REGULATED-DISABLED** | Route exists; live regulated connectivity off |
| **UNUSED** | Catalogued but not implemented |
| **LEGACY** | Deprecated; use replacement route |
