# Phase H Prompt 5 — MoonRey Productive Economy Data Platform

This record productizes the economic-data system under MoonRey's
productive-economy model.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. Mainnet remains inactive.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Observations may become economic inputs for MoonRey policy. They do
not set MoonRey market price. They do not automatically mint MoonRey.

## Canonical implementation

| Concern | Owner | Notes |
| --- | --- | --- |
| Productive Economy Data Platform | `packages/sunrey-chain/src/productive/economy-data` | This prompt |
| Productive objects / claims | `packages/sunrey-chain/src/productive` | Chunk 44 |
| Canonical units | `packages/sunrey-chain/src/units` | Chunk 118 |
| Oracle consensus | `packages/sunrey-chain/src/oracle/engine.ts` | Facts are not money |
| Production oracle / fabric | `packages/sunrey-chain/src/oracle/production` | Phase D runtime |
| GPUV / Productive Value | `packages/sunrey-chain/src/productive/policy-governance/value-function` | GPUV is not MoonRey |
| MoonRey issuance | `packages/sunrey-chain/src/native-assets/issuance-pipelines.ts` | Phase G interface |
| Consumer BFF | `services/api` `/api/v1/economy/productive*` | Read-only |
| Agent | `packages/sunrey-agent` `getProductive*` | Read-only |

Do not create `packages/productive-economy-data`,
`packages/moonrey-data-fabric`, or a second oracle.

## Ingestion path

external provider
→ authentication / signature
→ schema validation
→ provenance
→ normalization
→ quality
→ observation registry
→ Productive Value methodology
→ issuance proposal
→ authorized native-asset transition

There is no `oracle → mint` path. A configured provider is not
automatically trusted.

## Client surface

- `GET /api/v1/economy/productive`
- `GET /api/v1/economy/productive/categories`
- `GET /api/v1/economy/productive/history`
- `GET /api/v1/economy/productive/sources`
- `GET /api/v1/economy/productive/moonrey-input`

Lovable may render verified/configured category cards only.

## Validation (this revision)

| Suite | Result |
| --- | --- |
| Productive-economy data | 12/12 pass |
| Oracle / fabric | 345/345 pass |
| MoonRey issuance (native-assets) | 17/17 pass |
| Exchange / market-data | 98/98 pass |
| Agent | 85/85 pass |
| SDK | 57/57 pass |
| Consumer BFF (economy, agent, accounts, cards, exchange, HTTP, payments, wallets, home) | pass |
| Consumer BFF grow approve-without-step-up | 1 pre-existing fail (401 vs expected 403) |
| Privacy / security | 34/34 pass |
| Integrity + Python architecture extraction | pass |
| `lint:architecture` | 5 pre-existing exchange/API dependency violations |
| Repo-wide `tsc --noEmit` | still red on pre-existing Agent/Exchange/Grow merge types |
| PostgreSQL persistence | not run (no Docker / psql in this environment) |

Phase H Prompts 1–4 documents are not present in this tree.
`SAFE_TO_PROCEED_TO_PHASE_H_PROMPT_6=false` until those prompts exist
and repo-wide typecheck / architecture lint are green.

## Remaining gates

Real licensed energy, compute, manufacturing, agriculture, and
logistics providers are still required before production. Governance
must still approve a methodology, freshness override policy, and any
MoonRey issuance. Production remains disabled.

Prompt 5 does not start Prompt 6.
