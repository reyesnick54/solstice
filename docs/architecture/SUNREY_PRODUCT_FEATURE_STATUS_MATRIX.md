# SunRey Product Feature Status Matrix

Status codes:

| Code | Meaning |
| --- | --- |
| `LIVE_INTERNAL` | Operational on internal/staging rails (not production) |
| `SANDBOX` | Simulation sandbox with deterministic fixtures |
| `SIMULATION` | Kernel-gated domain logic, simulation providers only |
| `FRONTEND_ONLY` | UI exists without backend contract |
| `BACKEND_ONLY` | Backend contract without consumer UI in repo |
| `DISABLED` | Feature gate off / not available |
| `REGULATED_PROVIDER_REQUIRED` | Needs live regulated provider |
| `NOT_IMPLEMENTED` | No contract or stub only |

Environment: **`simulation`**. All `LIVE_*` flags **`false`**.

## Core experiences

| Feature | Status | BFF route / owner | Notes |
| --- | --- | --- | --- |
| **Home — Total Wealth** | SIMULATION | `GET /api/v1/me/home` → `services/accounts` | Ledger-derived; no client sum |
| **Home — SunRey balance** | SANDBOX | `nativeCoins.sunrey` → `packages/custody` | Authoritative custody read |
| **Home — MoonRey balance** | SANDBOX | `nativeCoins.moonrey` → `packages/custody` | Productive economy context |
| **Home — Action Center summary** | SANDBOX | `actionCenter` → `action-center.ts` | Unified backend component |
| **Home — Grow summary** | SIMULATION | `grow` → `packages/platform` | Simulation laboratory |
| **Home — Recent activity** | SIMULATION | `recentActivity` → ledger | |
| **Home — Access summary** | SANDBOX | `access` → `human-access-economy` | |
| **Home — Economic indicators** | SANDBOX | `economicIndicators` | Unverified = `verified: false` |
| **Money — Accounts** | SIMULATION | `/api/v1/accounts` | Kernel-gated |
| **Money — Payments** | SIMULATION | `/api/v1/payments` | No live rails |
| **Money — Wallets (SunRey/MoonRey)** | SANDBOX | `/api/v1/wallets` | Custody simulation |
| **Money — Cards** | SIMULATION | `/api/v1/cards` | Simulated issuer |
| **Money — FX** | SIMULATION | `/api/v1/fx` | Reference only |
| **Grow My Money** | SIMULATION | `/api/v1/grow/*` | Advice vs execution separated |
| **Grow — Live brokerage** | REGULATED_PROVIDER_REQUIRED | — | Sandbox proposals only |
| **Agent — Conversations** | SANDBOX | `/api/v1/agent/conversations` | |
| **Agent — Mandates** | SANDBOX | `/api/v1/agents/{id}/mandates` | In-memory until PG durable |
| **Agent — Authorization policy** | BACKEND_ONLY | `/api/v1/agent/authorization-policy` | Explicit forbidden list |
| **Agent — Execution** | DISABLED | — | Human approval only |
| **Vault — Records** | SIMULATION | `/api/v1/data/vault/*` | PDV product |
| **Vault — Consent** | SIMULATION | `/api/v1/data/consents` | |
| **Vault — Opportunities** | SANDBOX | `/api/v1/data/vault/opportunities` | No issuance promise |
| **Exchange — Markets** | SANDBOX | `/api/v1/exchange/markets` | `liveExchangeEnabled: false` |
| **Exchange — SunRey context** | SANDBOX | Human economy labels | Not GPUV price |
| **Exchange — MoonRey context** | SANDBOX | Productive economy labels | Not GPUV price |
| **Exchange — Live trading** | REGULATED_PROVIDER_REQUIRED | — | Preview/approve/submit sandbox |
| **Action Center — Unified** | SANDBOX | `GET /api/v1/action-center` | Wave 8 component |
| **Action Center — Agent cards** | SANDBOX | `/api/v1/agent/actions` | |
| **Action Center — Kernel approvals** | SIMULATION | `/api/v1/me/actions` | |
| **Access economy** | SANDBOX | `/api/v1/access/*` | |
| **HIN participation** | SIMULATION | `/api/v1/hin/*` | No mint formula exposed |
| **Economic data — Productive** | SANDBOX | `/api/v1/economy/productive/*` | |
| **Economic data — World** | SANDBOX | `/api/v1/world/*` | Fixture adapters |
| **Notifications inbox** | NOT_IMPLEMENTED | — | Action Center partial substitute |
| **Application state** | BACKEND_ONLY | `/api/v1/me/application-state` | Degradation hints |
| **Sandbox mode** | SANDBOX | Headers + `sandbox` object | Product-wide |
| **Mobile app UI** | FRONTEND_ONLY | — | SDK/sync interfaces exist |
| **Lovable consumer UI** | FRONTEND_ONLY | External project | BFF contract in repo |

## Infrastructure (Wave 8 sovereign plan — not consumer UI)

| Feature | Status | Notes |
| --- | --- | --- |
| PostgreSQL mandates/consent | NOT_IMPLEMENTED | In-memory on BFF paths |
| Kernel HTTP wiring (all mutations) | BACKEND_ONLY | Partial; R7 risk |
| Durable agent mandate store | NOT_IMPLEMENTED | `InMemoryAgentMandateStore` |
| Wallet signing separate from login | SIMULATION | Custody sandbox |
| Production activation | DISABLED | Chunk 143 firewall |

## Consumer client integration checklist

1. Boot: `GET /api/v1/me/bootstrap` (includes `applicationState`, `sandbox`)
2. Home: `GET /api/v1/me/home` (never sum balances client-side)
3. Capabilities: `GET /api/v1/me/capabilities` before rendering features
4. Action Center: `GET /api/v1/action-center`
5. Use SDK: `createSunReyConsumerBffClient`
6. Respect `sandbox.sandboxDataIsNotReal` and `productionMoneyMovement: false`

## Test coverage

| Test file | Scope |
| --- | --- |
| `tests/wave-8-consumer-product-e2e.test.ts` | Wave 8 product workflows |
| `services/api/src/consumer.test.ts` | Home, bootstrap, degradation |
| `tests/phase-f-conversation-e2e.test.ts` | Agent action flows |
| `tests/phase-g-exchange-e2e.test.ts` | Exchange sandbox |
| `tests/phase-e-grow-e2e.test.ts` | Grow lifecycle |
