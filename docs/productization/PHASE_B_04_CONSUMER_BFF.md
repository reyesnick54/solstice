# Phase B Prompt 4 — Consumer Backend-for-Frontend

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

The Consumer BFF is the application-facing orchestration layer for the
future SunRey mobile app, responsive web app, and Lovable-generated UI.
It converts many internal domain reads into customer-oriented resources
so Lovable never needs the internal package topology.

This prompt does not start Prompt 5.

## BFF architecture

Canonical owner: `services/api`

Authoritative path: `services/api/src/consumer/orchestrator.ts`

HTTP mount: `handleConsumerBff` / `startConsumerBff`

The BFF is **not**:

- a Ledger
- an Exchange
- an Agent runtime
- a compliance engine
- an investment engine
- a payment processor

It calls canonical domain services. Authoritative balances come from
`services/accounts` Ledger-derived read models
(`projectBankingPosition`, `projectCustomerPosition`). The BFF never
recalculates a balance by summing activity arrays and never issues
Execution Authority or posts journals.

Path prefix `/api/v1` is deliberately distinct from the developer /
chain gateway `/v1` so banking accounts and chain accounts do not
collide (P0-8).

## Resource model

Groups: ME, HOME, ACCOUNTS, ACTIVITY, PAYMENTS, RECIPIENTS, FX, CARDS,
GROW, GOALS, PORTFOLIO, AGENT, EXCHANGE, WALLETS, DATA, SECURITY,
NOTIFICATIONS.

Each group is labeled:

- `IMPLEMENTED` / `AVAILABLE_SIMULATION` — wired to an existing canonical service in simulation
- `NOT_YET_PRODUCTIZED` — honest empty catalog
- `EXTERNAL_PROVIDER_REQUIRED` — domain exists but live provider is absent

## Home contract

`GET /api/v1/me/home` → `sunrey.consumer.home.v1`

Populated from canonical reads when available:

- user summary
- total wealth + cash / investments / digital-assets class breakdown
- recent activity (cursor page)
- Grow / Agent / pending approvals / notifications / security alerts

Unavailable fields stay null with an explicit `state` and `reason`.
Mixed-currency customers do not receive a blended total.

## Bootstrap contract

`GET /api/v1/me/bootstrap` → `sunrey.consumer.bootstrap.v1`

Returns profile summary, session/device summary, feature capabilities,
pending actions, notification summary, and client-safe application
configuration (environment, supported currencies/assets). No secrets or
provider credentials.

## Capabilities

`GET /api/v1/me/capabilities`

Boolean flags plus structured `details` derived from environment,
jurisdiction, user eligibility, provider state, and product
configuration. Lovable cannot enable a regulated feature locally.

## Pagination

One cursor standard for activity/feed resources:

```json
{ "items": [], "nextCursor": null, "hasMore": false }
```

## Status models

Client-safe enumerations live at `GET /api/v1/catalog/enums`:

- transaction status
- action status (`PENDING`, `ACTION_REQUIRED`, `AWAITING_APPROVAL`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`)
- account type, asset type, risk display, approval requirement
- verification state, provider availability

Internal Kernel states such as HOLD / REQUIRE_MANUAL_REVIEW are mapped,
not hidden.

## Cache policy

| Class | Cache-Control | Used for |
| --- | --- | --- |
| Financial | `no-store, no-cache, private` | Home, accounts, activity, profile |
| Bootstrap | `private, max-age=15, must-revalidate` | bootstrap, capabilities |
| Catalog | `private, max-age=60, must-revalidate` | enums, resource catalog |

Nothing is publicly cacheable. `Vary: Authorization` is always set.
Authentication is never satisfied from cache.

## Fixtures

`GET /api/v1/sandbox/personas` lists deterministic non-production
personas. Tokens are `sandbox.<id>`:

- `basic_verified`
- `kyc_pending`
- `multi_currency`
- `investment`
- `agent_enabled`
- `exchange`
- `restricted`
- `provider_down`

Balances on these personas are posted through Kernel-gated
`services/accounts`. The BFF does not invent them.

## Lovable integration strategy

1. Authenticate via the Phase B identity/session foundation.
2. Call `GET /api/v1/me/bootstrap` once per launch.
3. Render screens from the mapping in
   [`SUNREY_LOVABLE_BFF_MAPPING.md`](./SUNREY_LOVABLE_BFF_MAPPING.md).
4. Treat `state` as the loading / empty / degraded contract.
5. Never enable payments, FX, cards, withdrawals, or Exchange because
   a client flag was guessed.

Mobile and responsive web share the same semantic resources. The BFF
does not embed presentation layout.

## Authority boundary

The BFF cannot bypass Kernel, Execution Authority, or the Ledger.
Mutating money remains `services/accounts` after a verified authority.
Agent ALLOW remains “fit for a human to consider.”
