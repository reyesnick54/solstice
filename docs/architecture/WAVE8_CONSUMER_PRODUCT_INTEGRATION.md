# Wave 8 — Consumer Product Integration

Wave 8 connects the production architecture to user experience **without embedding backend authority inside the frontend**. The consumer surface is the **Consumer BFF** (`/api/v1/*`) and typed SDK (`@solstice/sunrey-sdk/consumer-bff`). There is no in-repo React/mobile UI; Lovable and mobile clients integrate via these contracts.

## Architecture principle

| Layer | Role |
| --- | --- |
| **External clients** | Lovable / mobile / web — render API responses only |
| **Consumer BFF** | `services/api/src/consumer/` — orchestration, aggregation, capability gates |
| **Canonical owners** | Accounts, Kernel, Ledger, Exchange, Agent, Vault, Custody |
| **SDK** | `packages/sunrey-sdk/src/consumer-bff/` — browser-safe typed client |

**Client cache may display state. Backend and chain remain authoritative.** Balances are never computed in the browser.

## Integration surfaces

### Home (`GET /api/v1/me/home`)

Aggregates:

- **Total SunRey Wealth** — ledger-derived via `services/accounts` (`wealth` field)
- **SunRey / MoonRey balances** — `nativeCoins` from custody wallet read models
- **Action Center summary** — `actionCenter` counts from unified action center
- **Grow My Money** — `grow` resource field (simulation laboratory)
- **Recent activity** — ledger activity pagination
- **Access / network** — `access` resource when access economy is wired
- **Economic indicators** — `economicIndicators` (simulation; unverified observations marked `verified: false`)
- **Sandbox metadata** — `sandbox` block on every home response

### Money (`/api/v1/accounts`, `/api/v1/payments`, `/api/v1/wallets`, `/api/v1/cards`)

- Wallet, send, receive, convert, transaction history via existing BFF routes
- Regulated functions without live providers return `FEATURE_DISABLED`, `SANDBOX`, or `EXTERNAL_PROVIDER_REQUIRED` per capability map
- No fake live money movement (`productionMoneyMovement: false` on all mutation responses)

### Grow My Money (`/api/v1/grow/*`)

- Integrated with Wave 7 mandate/policy controls via agent permissions
- **Advice / analysis** separated from **execution** — proposals require human approval
- Sandbox recommendation and action-plan flows when live brokerage is unavailable

### Agent authority (`GET /api/v1/agent/authorization-policy`)

Explicit policy document. Agents **must not**:

- Mint SunRey or MoonRey
- Approve issuance
- Change consent
- Elevate permissions
- Change monetary policy
- Withdraw beyond mandate
- Execute while feature-disabled

Mandate HTTP surface:

- `GET /api/v1/agents/{id}/mandates` — read mandate (user, agent, allowed data/accounts/actions, purpose, limits, expiration)
- `POST /api/v1/agents/{id}/mandates` — grant/update mandate (simulation)
- `POST /api/v1/agents/{id}/mandates/{mandateId}/revoke` — revoke

### Vault (`/api/v1/data/vault/*`, `/api/v1/data/consents`)

User control center for permissions, consent, data categories, sources, usage receipts, active authorizations, agent permissions, HIN participation, revocation.

**Vault opportunities** (`GET /api/v1/data/vault/opportunities`):

- Research participation, authorized computation, credential verification, contribution verification, data-use opportunities
- Each opportunity states purpose, requested categories, recipient, benefit methodology, duration, revocation, rights
- **`mintsSunRey: false`** — no issuance promised for opt-in

### Exchange (`/api/v1/exchange/*`)

- SunRey Coin tab — Human Economy context (`economyContext: HUMAN_ECONOMY`)
- MoonRey Coin tab — Productive Economy context (`economyContext: PRODUCTIVE_ECONOMY`)
- Markets, portfolio, APIs via existing exchange BFF
- **GPUV is not market price** — `gpuvIsNotMarketPrice: true` on native coin views

### Economic data (`/api/v1/economy/*`, `/api/v1/world/*`)

Read-only economic awareness. Categories include energy, resources, compute, manufacturing, agriculture, real estate, travel, water, logistics. Unverified external observations carry `dataState: SIMULATED` and `verified: false`.

### Action Center (`GET /api/v1/action-center`)

First-class backend-driven component aggregating:

- Kernel pending approvals
- Agent action cards
- Access economy events
- External evidence signals

**States:** `ACTION_REQUIRED`, `IN_REVIEW`, `COMPLETED`, `DISMISSED`, `EXPIRED`

Actions deep-link to product workflows (`deepLink` field). Dismiss via `POST /api/v1/action-center/{id}/dismiss`.

### Application state (`GET /api/v1/me/application-state`)

Handles refresh, reconnect, stale cache, offline, API degradation, chain syncing:

- `connectivity`: `ONLINE` | `DEGRADED` | `OFFLINE` | `CHAIN_SYNCING`
- `authoritativeSource`: `BACKEND`
- `frontendMathAuthoritative`: `false`
- `degradedServices[]` when providers are down

### Sandbox mode

Product-wide sandbox metadata (`sandbox-mode.ts`):

- Response headers: `x-sunrey-sandbox-mode: true`, `x-sunrey-production-active: false`
- Bootstrap and home include `sandbox` object with `mode`, `sandboxDataIsNotReal`, `transactionsAreSimulated`
- Sandbox personas: `Bearer sandbox.<persona_id>` via `GET /api/v1/sandbox/personas`

### Mobile / web contract parity

Both clients use the same BFF contracts and SDK. Business logic remains server/domain-side. No duplicated balance computation.

## SDK methods (Wave 8 additions)

```typescript
client.getHome({ valuationCurrency?: string })
client.getBootstrap()
client.getApplicationState()
client.getCapabilities()
client.getActionCenter()
client.dismissActionCenterItem(actionId)
client.getAgentAuthorizationPolicy()
client.getAgentMandate(agentId)
client.grantAgentMandate(agentId, input)
client.revokeAgentMandate(agentId, mandateId)
client.listVaultOpportunities()
```

## Key files

| File | Purpose |
| --- | --- |
| `services/api/src/consumer/home-integration.ts` | Home enrichment (native coins, indicators) |
| `services/api/src/consumer/action-center.ts` | Unified Action Center |
| `services/api/src/consumer/sandbox-mode.ts` | Sandbox metadata |
| `services/api/src/consumer/application-state.ts` | Degradation / cache hints |
| `services/api/src/consumer/agent-authorization.ts` | Agent forbidden authorities |
| `services/api/src/consumer/agent-mandates.ts` | Mandate HTTP surface |
| `services/api/src/consumer/vault-opportunities.ts` | Vault opportunity catalog |
| `packages/sunrey-sdk/src/consumer-bff/client.ts` | Typed SDK client |
| `tests/wave-8-consumer-product-e2e.test.ts` | End-to-end product tests |

## Validation

```bash
npm test
npm run ci
```

## Wave 8 scope boundary

Wave 8 consumer integration does **not**:

- Enable `LIVE_*` flags or change `ENVIRONMENT` away from `simulation`
- Create a second ledger, Kernel, or Execution Authority path
- Allow frontend or agent minting
- Activate production valuation or issuance

Durable PostgreSQL for mandates/consent remains a Wave 8 infrastructure follow-up per sovereign architecture plan.
