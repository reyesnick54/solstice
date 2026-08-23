# SunRey Lovable screen readiness

Phase I Prompt 6 definitive frontend readiness table.

This is not production authorization.

`ENVIRONMENT=simulation`
`BACKEND_PRODUCTION_RELEASE_CANDIDATE=true`
`LOVABLE_BACKEND_READY=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Use only public/client-safe surfaces:

- `@solstice/sunrey-sdk/consumer` — `/v1/consumer/*`
- `@solstice/sunrey-sdk/bff` — `/api/v1/*`
- `api/sunrey-consumer-platform-v1.openapi.yaml`
- `api/sunrey-consumer-bff-v1.openapi.yaml`
- `api/sunrey-exchange-v1.openapi.yaml`
- `api/sunrey-chain-v1.openapi.yaml`

Do not import Ledger, Kernel, Execution Authority, or persistence.

| Screen | Backend / API / SDK | Readiness | Notes |
| --- | --- | --- | --- |
| ONBOARDING | `/v1/consumer/bootstrap`, `/api/v1/me/bootstrap`, capabilities | READY_FOR_LOVABLE | Server owns eligibility. KYC images are not a Lovable upload path. |
| LOGIN | `docs/productization/SUNREY_FRONTEND_AUTH_GUIDE.md` | READY_FOR_LOVABLE | Session, device trust, step-up. Not KYC. |
| HOME | `GET /api/v1/me/home`, `GET /v1/consumer/home` | READY_FOR_LOVABLE | Ledger projection. No client-summed wealth. |
| MONEY | `GET /api/v1/accounts` | READY_FOR_LOVABLE | Integer minor units. No yield field. |
| ACCOUNTS | `GET /api/v1/accounts/{id}` | READY_FOR_LOVABLE | posted / available / held. |
| ACTIVITY | `GET /api/v1/accounts/{id}/activity` | READY_FOR_LOVABLE | Cursor page. |
| SEND | `POST /api/v1/payments` + quote/approve | READY_FOR_LOVABLE | Sandbox rails. Live rail = provider gate. |
| RECIPIENTS | `/api/v1/recipients` | READY_FOR_LOVABLE | Agents cannot add beneficiaries. |
| FX | `/api/v1/fx/quotes` accept/execute | READY_FOR_LOVABLE | Server-owned rate. USD/SAR sandbox. |
| CARDS | `/api/v1/cards` | READY_FOR_LOVABLE | Simulated issuer. No PAN/CVV required to render. |
| GROW | `/api/v1/grow` | READY_FOR_LOVABLE | `achievementPromised: false`. |
| GOALS | `/api/v1/grow/goals` | READY_FOR_LOVABLE | User-declared only. |
| PORTFOLIO | `/api/v1/grow/portfolio` | READY_FOR_LOVABLE | Deposits are not performance. |
| AGENT | `/api/v1/agents`, `/api/v1/agent/conversations` | READY_FOR_LOVABLE | Text is not authorization. |
| ACTION CENTER | `/api/v1/agent/actions` | READY_FOR_LOVABLE | Human approve / modify / reject. |
| EXCHANGE | `/api/v1/exchange` | READY_FOR_LOVABLE | `liveExchangeEnabled: false`. FILLED ≠ SETTLED. |
| SUNREY COIN | `/api/v1/economy`, `/api/v1/assets/SUNREY_COIN` | READY_FOR_LOVABLE | Read-only supply. No mint endpoint. |
| MOONREY COIN | `/api/v1/economy`, productive MoonRey input | READY_FOR_LOVABLE | GPUV is not a token amount. |
| WALLETS | `/api/v1/wallets` | READY_FOR_LOVABLE | Production signing disabled. |
| VAULT | `/api/v1/data/vault` | READY_FOR_LOVABLE | `sunreyOwnsUserData: false`. No get-all-user-data. |
| HIN | `/api/v1/hin/*` | READY_FOR_LOVABLE | Usage rights only. Compensation not guaranteed. |
| PROFILE | `GET/PATCH /api/v1/me` | READY_FOR_LOVABLE | Client-safe KYC metadata only. |
| SECURITY | `GET /api/v1/security` | READY_FOR_LOVABLE | Sessions / devices / alerts. |
| NOTIFICATIONS | bootstrap pending actions + activity | READY_FOR_LOVABLE | Dedicated push inbox is SANDBOX_FUNCTIONAL; no second notification plane. |
| SUPPORT | error catalog `request_id` | READY_FOR_LOVABLE | Human support desk staffing is an external gate. |

Streaming: `GET /api/v1/exchange/stream` and agent conversation events. See the integration guide.

Action Card schema: `sunrey.consumer.action-card.v1` on agent turns. Render `availableActions` from the server.

Sandbox personas remain behind `SUNREY_SANDBOX_PERSONAS=1`.
