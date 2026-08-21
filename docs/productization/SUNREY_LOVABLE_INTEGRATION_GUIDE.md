# SunRey Lovable integration guide

Primary frontend handoff. A Lovable or frontend team should not need
internal packages.

Phase B creates a production-quality platform interface. It does not
connect live banking providers.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## API base URL configuration

The SDK takes `baseUrl`. It does not hardcode an environment.

```ts
import { createSunReyConsumerClient, createMemoryTokenStore } from '@solstice/sunrey-sdk/consumer';

const auth = createMemoryTokenStore();
const client = createSunReyConsumerClient({
  baseUrl: process.env.SUNREY_CONSUMER_API_URL ?? 'http://127.0.0.1:18580',
  auth,
});
```

## Environments

| Name | Current status |
| --- | --- |
| LOCAL | Implemented for developers (`SUNREY_CONSUMER_HOST/PORT`) |
| TEST | Implemented in automated harnesses |
| SANDBOX | Implemented when `SUNREY_SANDBOX_PERSONAS=1` |
| STAGING | Not operational |
| PREPRODUCTION | Not operational |
| PRODUCTION | Not operational and must stay disabled |

Ask `/v1/consumer/version` for `integration_environment`. Bootstrap
always reports `environment: simulation` and production flags false.

## Authentication

See `docs/productization/SUNREY_FRONTEND_AUTH_GUIDE.md`.

Send `Authorization: Bearer <access_token>` and `X-Request-Id`.

## SDK installation / use

Workspace package `@solstice/sunrey-sdk` export `./consumer`
(auth/home/accounts) and `./bff` (Consumer BFF `/api/v1` payments).

Supported:

- base URL
- token/session integration
- refresh hook (`onUnauthorized`)
- request IDs
- typed responses and `SunReyConsumerError`
- pagination helpers (`asConsumerPage`)
- idempotency keys
- abort signals / timeouts

The consumer export is browser-safe. It does not include database
clients, Ledger, Execution Authority, private keys, or Node privileged
modules.

## Bootstrap

`GET /v1/consumer/bootstrap` after login. Use it for:

- session
- capabilities
- feature flags
- production posture
- degraded notices

Do not cache capabilities across users.

## Home

`GET /v1/consumer/home` returns greeting, account count, optional
position, attention items, and feature flags. Position is a server
ledger projection. Lovable never calculates authoritative balances.

## Accounts

`GET /v1/consumer/accounts` and `GET /v1/consumer/accounts/{accountId}`.
`balance.minor_units` is an integer string. There is no yield, APY, or
growth-rate field.

## Feature capabilities

`GET /v1/consumer/capabilities` and `GET /v1/consumer/features/{id}`.
`investments` and `exchange_trading` on the `/v1/consumer` platform
surface remain feature-flagged. Consumer BFF `/api/v1/cards` is
AVAILABLE_SIMULATION: list, detail, freeze, unfreeze, controls, and
wallet eligibility. Live issuing is not connected. Lovable must use
server capability/eligibility responses and must not require PAN/CVV
to render the card dashboard.

## Approval states

`POST /v1/consumer/actions` currently implements `OPEN_ACCOUNT` only.
States: `ALLOW`, `REQUIRE_MANUAL_REVIEW`, `DEFER`, `BLOCK`,
`FEATURE_UNAVAILABLE`, `UNAUTHENTICATED`.

On `REQUIRE_MANUAL_REVIEW` or `DEFER`, read `/v1/consumer/approvals`.
Nothing is posted until Kernel ALLOW plus verified Execution Authority
inside `services/accounts`.

## Errors

See `docs/productization/SUNREY_API_ERROR_CATALOG.md`.
Use `error_code`, `retryable`, `user_action_required`, and
`safe_to_display`. Always log `request_id`.

## Pagination

`cursor` + `page_size` (default 20, max 100). Follow `next_cursor`.
Invalid cursors return `INVALID_PAGINATION_CURSOR`.

## Loading / degraded states

Bootstrap includes `degraded`. Health is `/health` and
`/v1/consumer/health`. Treat `PROVIDER_UNAVAILABLE` and
`INTERNAL_ERROR` as retryable degraded states. Do not invent balances
while degraded.

## Payments (Consumer BFF `/api/v1`)

Use `@solstice/sunrey-sdk/bff` (`SunReyConsumerBffClient`). This is
not the chain `/v1` client.

Journey:

1. `GET /api/v1/recipients` — select recipient, or `POST` to add one
2. Enter amount (integer minor units)
3. `POST /api/v1/payments/quote` — fees, route, compliance state
4. Review. `settlementTimePromise` is always `null`
5. Step-up if the BFF returns `STEP_UP_REQUIRED`
6. `POST /api/v1/payments` with `Idempotency-Key`
7. `POST /api/v1/payments/{id}/approve` when the quote required confirmation
8. Poll `GET /api/v1/payments/{id}` — backend owns `status`

Do not mark a recipient verified from the client. Do not promise
settlement time. `productionMoneyMovement` is always `false`.

BFF sandbox personas (`basic_verified`, `restricted`, …) use
`sandbox.<persona_id>` tokens against `/api/v1`. They are distinct from
the `/v1/consumer` personas below.

## Sandbox personas

| Persona | Intent |
| --- | --- |
| `alex-ready` | Has a deposit account |
| `blair-restricted` | No `ACCOUNT_OPEN_REQUEST` |
| `casey-capable` | May open an account through Kernel |
| `drew-empty` | View-capable, no accounts |
| `evan-paged` | Paginated activity |

Enable only with `SUNREY_SANDBOX_PERSONAS=1` in simulation. Fail closed
otherwise.

## Request IDs

Send `X-Request-Id`. The server echoes it on every response, including
errors. The SDK generates one when the caller does not.

## Security requirements

- HTTPS in any hosted environment
- Store tokens as the product security model requires; never in source
- No privileged server secrets in Lovable
- Webhook URLs are localhost-only in this simulation

## What Lovable must never do

Lovable never calculates authoritative balances.

Lovable never writes directly to Ledger.

Lovable never directly accesses internal services.

Lovable never stores privileged server secrets.

Lovable never treats Agent text as authorization.

Lovable must use server capability/eligibility responses.
