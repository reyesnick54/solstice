# Wave 8 — Consumer API and BFF Integration

**Version:** 1.0.0-wave8  
**Status:** Implemented (simulation)  
**Owner:** `services/api` (Consumer BFF orchestration)  
**Companion:** `docs/api/SUNREY_CONSUMER_API.md`, `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`

---

## 1. Objective

Modernize the SunRey API/BFF layer so mobile and web applications consume the complete architecture through stable, secure product contracts. The API orchestrates domain services. It does **not** become domain authority.

---

## 2. API Domains

| Domain | Base path | Classification | Owner |
|--------|-----------|----------------|-------|
| identity | `/api/v1/me` | SIMULATION | `packages/identity` |
| home | `/api/v1/me/home` | SIMULATION | `services/accounts` reads |
| money | `/api/v1/accounts`, `/api/v1/payments`, `/api/v1/fx`, `/api/v1/cards` | SIMULATION | `services/accounts`, `packages/payments` |
| wallet | `/api/v1/wallets` | SIMULATION | `packages/custody` |
| grow | `/api/v1/grow` | SIMULATION | `packages/platform` Growth Orchestrator |
| vault | `/api/v1/data/vault` | SIMULATION | `packages/personal-data-vault` |
| exchange | `/api/v1/exchange` | SIMULATION | `packages/sunrey-exchange` |
| sunrey | `/api/v1/sunrey` | SIMULATION | `packages/sunrey-chain` native-assets + HIN |
| moonrey | `/api/v1/moonrey` | SIMULATION | `packages/sunrey-chain` productive economy |
| economy | `/api/v1/economy` | SIMULATION (legacy alias) | Combined native overview |
| providers | `/api/v1/world` | SANDBOX | `packages/external-data` |
| claims | `/api/v1/hin/contributions` | SIMULATION | `packages/human-economic-contribution` |
| evidence | `/api/v1/agent/external-evidence` | SIMULATION | external-data bridges |
| consent | `/api/v1/data` | SIMULATION | `packages/consent` |
| actions | `/api/v1/actions` | SIMULATION | Agent + orchestrator |
| network | `/api/v1/blockchain` | SANDBOX | blockchain-intelligence |
| access | `/api/v1/access` | SIMULATION | `packages/human-access-economy` |
| agent | `/api/v1/agent` | SIMULATION | `packages/sunrey-agent` |
| notifications | `/api/v1/notifications` | UNUSED | not productized |

Admin/governance interfaces remain under `/api/v1/internal` and are separated from consumer APIs.

---

## 3. Endpoint Audit Summary

### HIN — SIMULATION
- `GET /api/v1/hin/contributions`, `/metrics`, `/me/summary` — read-only contribution surfaces
- `GET /api/v1/hin/rights`, `/licenses`, `/earnings` — information marketplace (SIMULATION)
- No verification or issuance mutation on BFF

### Productive Economy — SIMULATION
- `GET /api/v1/economy/productive/*` — legacy paths
- `GET /api/v1/moonrey/*` — Wave 8 canonical MoonRey product domain

### Native Economy — SIMULATION
- `GET /api/v1/economy`, `/supply`, `/assets` — protocol supply reads
- `GET /api/v1/sunrey/*` — Wave 8 canonical SunRey product domain

### World External Data — SANDBOX
- `GET /api/v1/world/*` — fixture/sandbox provider observations only

### Blockchain Intelligence — SANDBOX
- `GET /api/v1/blockchain/*` — read-only external chain metadata

### Exchange — SIMULATION
- Full consumer exchange lifecycle (markets, orders, stream SSE)

### Wallet — SIMULATION
- Custody product routes; production signing disabled

### Grow — SIMULATION
- Plans, goals, portfolio, proposals; no live brokerage

### Vault — SIMULATION
- PDV subject-bound records; no raw storage paths

### Legacy / Deprecated
| Route | Replacement | Sunset |
|-------|-------------|--------|
| `GET /api/v1/me/actions` | `GET /api/v1/actions` | 2026-12-01 |
| `GET /api/v1/economy/sunrey-coin` | `GET /api/v1/sunrey/supply` | 2026-12-01 |
| `GET /api/v1/economy/moonrey-coin` | `GET /api/v1/moonrey/supply` | 2026-12-01 |
| `GET /api/v1/portfolio` | `GET /api/v1/grow/portfolio` | 2026-12-01 |
| `GET /api/v1/goals` | `GET /api/v1/grow/goals` | 2026-12-01 |

---

## 4. Contract Versioning

- Contract version: `1.0.0-wave8` (`x-sunrey-contract-version` header)
- API version: `v1` (`x-sunrey-api-version` header)
- Manifest: `GET /api/v1/catalog/contract`
- Domain catalog: `GET /api/v1/catalog/domains`
- Status semantics: `GET /api/v1/catalog/status-semantics`
- Shared types: `packages/sunrey-sdk/src/consumer-bff/types.ts`
- Breaking changes require explicit version bump; deprecations carry `Deprecation` / `Sunset` / `Link` headers

---

## 5. Product Status Semantics

### Blockchain operations
`SUBMITTED` → `PENDING` → `INCLUDED` → `EXECUTED` → `FINALIZED` | `REJECTED`

Clients must not treat `PROCESSING` or `COMPLETED` as finalized when the underlying state is not final.

### Economic claims
`OBSERVED` → `VERIFYING` → `VERIFIED` → `CLAIM_CREATED` → `VALUED` → `AWAITING_GOVERNANCE` → `AUTHORIZED` → `FINALIZED` | `CHALLENGED`

---

## 6. SunRey API (`/api/v1/sunrey`)

| Route | Purpose |
|-------|---------|
| `GET /balance` | User SunRey balance read model |
| `GET /supply` | Protocol supply (canonical `AssetSupplyBook` facade) |
| `GET /contributions/status` | Human economy contribution summary |
| `GET /contributions/history` | Verified contribution history (no raw HIN) |
| `GET /peve` | PEVE summary when identity-authorized |
| `GET /receipts` | Issuance receipts (simulation; production inactive) |
| `GET /network-status` | SunRey Chain simulation status |

`valuationDoesNotSetPrice: true` on all valuation surfaces. No mint endpoints.

---

## 7. MoonRey API (`/api/v1/moonrey`)

| Route | Purpose |
|-------|---------|
| `GET /balance` | User MoonRey balance |
| `GET /supply` | Protocol MoonRey supply |
| `GET /categories` | Productive economic categories |
| `GET /indicators` | Productive indicators by category |
| `GET /gpuv` | GPUV read model with explicit non-price disclaimers |
| `GET /claims` | Productive claims (observation does not mint) |
| `GET /receipts` | MoonRey economic receipts (simulation) |
| `GET /providers` | Public-safe provider status |

`gpuvIsNotMarketPrice`, `gpuvIsNotMoonReyQuantity`, `gpuvIsNotExchangePrice` enforced on GPUV responses.

---

## 8. Action Center

- Canonical: `GET /api/v1/actions` (unified, durable backend state)
- Stream: `GET /api/v1/actions/stream` (SSE)
- Sources: home pending approvals, agent action cards, access events, external evidence events
- `frontendIsNotSourceOfTruth: true` on all Action Center responses
- Legacy: `GET /api/v1/me/actions` (deprecated), `GET /api/v1/agent/actions` (agent-scoped)

---

## 9. Error Contract

Machine-readable BFF error codes (subset):

| Code | HTTP | Meaning |
|------|------|---------|
| `POLICY_DENIED` | 403 | Kernel/compliance/policy refusal |
| `CONSENT_REQUIRED` | 403 | Consent not granted |
| `IDENTITY_ASSURANCE_INSUFFICIENT` | 403 | KYC/verification incomplete |
| `CLAIM_DUPLICATE` | 403 | Duplicate claim |
| `CLAIM_DISPUTED` | 403 | Claim under dispute |
| `TRANSACTION_REJECTED` | 403 | Chain/custody rejection |
| `CHAIN_UNAVAILABLE` | 503 | Chain unreachable |
| `CHAIN_SYNCING` | 503 | Chain catching up |
| `PROVIDER_UNAVAILABLE` | 503 | Provider down |
| `REGULATED_FEATURE_DISABLED` | 403 | Regulated feature off |
| `SANDBOX_ONLY` | 403 | Operation not permitted outside sandbox |

Stack traces and secrets are never returned.

---

## 10. Authorization

- Server-side only; session-resolved `BffPrincipal.capabilities`
- Frontend role claims are never trusted
- Route requirements in `services/api/src/consumer/authorization.ts`
- Restricted accounts fail closed on regulated routes
- Verified identity required for payments, wallets, exchange mutations, vault, PEVE

---

## 11. Rate Limits and Abuse Controls

Existing platform controls (unchanged):
- Per-IP, per-user, per-session rate limits (`services/api/src/rate-limit.ts`)
- Request body size limits
- Cursor pagination on activity endpoints
- Idempotency keys on mutations (`Idempotency-Key` header)
- Exchange/wallet transaction-submission protection via Kernel gating downstream

Consumer API does not rate-limit blockchain consensus logic.

---

## 12. Realtime Events

| Endpoint | Transport | Events |
|----------|-----------|--------|
| `GET /api/v1/events/stream` | SSE | multiplexed product events |
| `GET /api/v1/actions/stream` | SSE | Action Center updates |
| `GET /api/v1/exchange/stream` | SSE | Exchange market updates |
| Agent conversation `events` | SSE/poll | conversation stream |

Event kinds: `TRANSACTION_FINALITY`, `BALANCE_CHANGE`, `CLAIM_STATUS`, `ACTION_CENTER`, `EXCHANGE_UPDATE`, `PROVIDER_STATUS`

Internal event bus is not exposed.

---

## 13. Tests

- `services/api/src/consumer-wave8-contract.test.ts` — Wave 8 contract tests
- Existing consumer tests: home, economy, exchange, grow, vault, wallets, hin, access
- Auth/policy failure paths covered in contract tests

---

## 14. Validation

```bash
npm test
npm run ci
```

---

## 15. Invariants Preserved

1. BFF does not mint, burn, or mutate `AssetSupplyBook`
2. GPUV ≠ MoonRey quantity ≠ Exchange price
3. PEVE ≠ issuance quantity
4. Raw HIN/PDV not exposed through consumer routes
5. `ENVIRONMENT=simulation`; `LIVE_*=false`
6. Kernel refusals returned unchanged
