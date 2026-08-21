# Phase D Prompt 1 — Universal production provider runtime

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`
`ENVIRONMENT=simulation`

This prompt productizes one canonical Provider Runtime. It does not
start Prompt 2. It does not activate a live financial provider, add
real secrets, or claim external certification.

`SAFE_TO_PROCEED_TO_PHASE_D_PROMPT_2=true`

## Canonical owner

Chunk 91 already implemented `sunrey-provider-runtime` at
`packages/sunrey-chain/src/provider-runtime`. The authority map forbids
`packages/provider-runtime`. Phase D extends that owner.

| Concern | Path |
| --- | --- |
| Universal runtime facade | `packages/sunrey-chain/src/provider-runtime/universal/runtime.ts` |
| Lifecycle | `packages/sunrey-chain/src/provider-runtime/universal/lifecycle.ts` |
| Registry / credentials | `packages/sunrey-chain/src/provider-runtime/universal/store.ts` |
| Routing | `packages/sunrey-chain/src/provider-runtime/universal/routing.ts` |
| Health / timeout / retry / circuit | `packages/sunrey-chain/src/provider-runtime/universal/control.ts` |
| Failover | `packages/sunrey-chain/src/provider-runtime/universal/failover.ts` |
| Webhook dispatch | `packages/sunrey-chain/src/provider-runtime/universal/webhook.ts` |
| Kill switch / limited live / certification | `packages/sunrey-chain/src/provider-runtime/universal/governance.ts` |
| Contract harness | `packages/sunrey-chain/src/provider-runtime/universal/harness.ts` |
| Durable snapshot | `packages/persistence/src/provider/universal-store.ts` |
| PostgreSQL | `db/customer/migrations/V033__provider_runtime.sql` |

Do not create `packages/provider-runtime`, `packages/integrations`, or
a second ledger.

## Lifecycle states

`DISABLED` → `SIMULATED` → `SANDBOX` → `CERTIFICATION` →
`PREPRODUCTION` → `LIMITED_LIVE` → `PRODUCTION`, plus `SUSPENDED`.

API, Agent, frontend, and ordinary environment variables cannot promote
a provider to `LIMITED_LIVE` or `PRODUCTION`. Those transitions also
fail closed while `ENVIRONMENT=simulation` and `LIVE_*` remain false.

## Credentials

Provider records store `secret://` references, a key version, and an
environment. Plaintext production credentials are rejected. Sandbox
credentials cannot satisfy production selection.

## Routing and failover

Routing is a deterministic, auditable filter-then-priority selection.
AI cannot freely choose a financial provider.

Failover:

- market-data read: `SAFE_TO_FAILOVER`
- FX quote before accept: `SAFE_TO_FAILOVER`
- submitted bank payment: `NOT_SAFE_TO_FAILOVER`
- unknown bank-payment status: `REQUIRES_RECONCILIATION`

## Certification

`INTERNAL_ADAPTER_TESTED` is not `EXTERNAL_PROVIDER_CERTIFIED`.
External certification requires approval and evidence references.

## BFF capabilities

`paymentsEnabled` / `fxEnabled` / `cardsEnabled` consult provider
configuration, lifecycle, and health. Sandbox reports sandbox
behavior. Source existence alone does not enable a feature.

## Persistence remapping

Customer migrations were remapped so versions stay unique and
contiguous: `V029` consumer authentication, `V030` treasury financial
control, `V031` cards productization, `V032` platform API, `V033`
provider runtime.

## Production posture

Production remains disabled. No live bank, card, FX, KYC, or rail
adapter is connected. Simulation providers stay inert under a
production configuration.
