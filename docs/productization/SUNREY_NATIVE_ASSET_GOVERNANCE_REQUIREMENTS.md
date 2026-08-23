# SunRey native-asset governance requirements

Human governance, not AI or developer code changes, decides
production economics for SunRey Coin and MoonRey Coin.

This is not legal advice and is not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`ENVIRONMENT=simulation`

## What AI may do

- Explain SunRey Coin and MoonRey Coin
- Simulate candidate supply, issuance, burn, and allocation models
- Draft issuance proposals for humans

## What AI may not do

- Approve economics
- Vote, activate, or authorize production issuance
- Self-approve an issuance proposal
- Generate missing mainnet values automatically
- Invent a public ticker
- Mint or burn native assets
- Treat simulation output as production configuration

## Required human authorization for mainnet economics

Any mainnet-economic configuration must include all of:

1. A versioned economic-policy document (`sunrey.native-asset.economic-policy.v1`)
2. Human authorization evidence (`authorizedBy: HUMAN_GOVERNANCE`)
3. An effective date (UTC)
4. The target network (`MAINNET`)
5. A content hash / signature / reference
6. A governance decision id

Missing any of these fails closed with `MISSING_GOVERNANCE` or
`MAINNET_ECONOMICS_NOT_AUTHORIZED`.

## Unresolved economic parameters

These remain human decisions. Current machine state is
`UNRESOLVED` or `NOT_AUTHORIZED`. Do not invent values in code.

| Parameter | Asset | Current state |
| --- | --- | --- |
| Public ticker / symbol | Both | `NOT_ASSIGNED` / `UNRESOLVED` |
| Maximum supply | Both | `NOT_AUTHORIZED` |
| Genesis supply | Both | `NOT_AUTHORIZED` (production default is zero unless an approved manifest exists) |
| Issuance caps | Both | `NOT_AUTHORIZED` |
| Period caps | Both | `NOT_AUTHORIZED` |
| Conversion schedules | Both | `NOT_AUTHORIZED` |
| Fee policy quantities | SunRey Coin | `NOT_AUTHORIZED` |
| Burn economics | Both | `NOT_AUTHORIZED` (burn mechanics exist; quantities/policy remain human) |
| Genesis allocation | Both | Mainnet blocked until approved; testnet allocations are labeled development units and cannot become mainnet values |
| Valuation parameters | Both | `NOT_AUTHORIZED` (engineering simulation only) |

## Technical enforcement already present

- Singular supply authority: `packages/sunrey-chain/src/economics/supply.ts`
- Mint gate: `packages/sunrey-chain/src/economics/issuance.ts`
- Productized gate and proposals: `packages/sunrey-chain/src/native-assets/`
- Production activation firewall: `packages/sunrey-chain/src/economics/production-activation/`
- Application journals remain a separate authority (`packages/sunrey-coin`) and are not imported
