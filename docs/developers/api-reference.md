# SunRey public API reference

Generated from the in-repo OpenAPI definitions and SDK route table.

- API version: `v1`
- Public surface: `PUBLIC_API`
- Operator surface: `OPERATOR_API`

## Namespaces

- CHAIN
- ACCOUNTS
- ASSETS
- FEES
- VALIDATORS
- GOVERNANCE
- ORACLES
- PRODUCTIVE_ECONOMY
- MACHINE_ECONOMY
- INTEROPERABILITY
- EXCHANGE
- MONETARY

## Public routes

- `GET /v1/chain/status`
- `GET /v1/chain/network`
- `GET /v1/chain/protocol`
- `GET /v1/network/phase`
- `GET /v1/network/capabilities`
- `GET /v1/network/health`
- `GET /v1/network/status`
- `GET /v1/chain/finality`
- `GET /v1/chain/blocks`
- `GET /v1/chain/transactions`
- `GET /v1/chain/state-roots`
- `POST /v1/accounts`
- `GET /v1/accounts/{id}`
- `GET /v1/assets`
- `GET /v1/assets/holdings/{id}`
- `GET /v1/monetary/policy`
- `GET /v1/monetary/supply`
- `GET /v1/monetary/genesis`
- `GET /v1/monetary/issuance/{id}`
- `GET /v1/monetary/burns`
- `GET /v1/fees/estimate`
- `GET /v1/fees/policy`
- `GET /v1/fees/price`
- `GET /v1/fees/estimate-v2`
- `GET /v1/validators`
- `GET /v1/validators/economics/policy`
- `GET /v1/validators/{id}/bond`
- `GET /v1/validators/{id}/rewards`
- `GET /v1/validators/{id}/penalties`
- `GET /v1/validators/{id}/unbond`
- `GET /v1/governance/proposals`
- `GET /v1/governance/operations/package`
- `GET /v1/governance/operations/diff`
- `GET /v1/governance/operations/activation`
- `GET /v1/governance/operations/emergency`
- `GET /v1/oracles/facts`
- `GET /v1/productive/moonrey`
- `GET /v1/productive/moonrey/policy`
- `GET /v1/productive/moonrey/supply-pressure`
- `GET /v1/treasury`
- `GET /v1/treasury/policy`
- `GET /v1/treasury/reserves`
- `GET /v1/treasury/budgets`
- `GET /v1/treasury/disbursements`
- `GET /v1/machines`
- `GET /v1/interop/packets`
- `GET /v1/exchange/markets`
- `POST /v1/exchange/orders`
- `POST /v1/transactions`
- `GET /v1/events`
- `POST /v1/dev/faucet`

## Operator routes

- `POST /operator/v1/produce-block`
- `GET /operator/v1/status`

## Event types

- `newFinalizedBlock`
- `transactionStatus`
- `accountActivity`
- `assetTransfer`
- `governanceProposal`
- `governanceActivation`
- `oracleFact`
- `productiveContribution`
- `moonreyIssuance`
- `machineSettlement`
- `exchangeTrade`
- `exchangeSettlement`
- `interopPacket`

## Developer platform (Chunk 94)

Control-plane routes live under `/v1/developer`. Specs:

Canonical specifications:

- `api/sunrey-chain-v1.openapi.yaml`
- `api/sunrey-exchange-v1.openapi.yaml`
- `api/sunrey-events-v1.md`
- `api/sunrey-developer-platform-v1.openapi.yaml`
- `api/sunrey-webhooks-v1.json`
