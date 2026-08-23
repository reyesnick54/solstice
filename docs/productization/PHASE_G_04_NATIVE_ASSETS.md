# Phase G Prompt 4 — SunRey Coin, MoonRey Coin, and native asset economic controls

This record productizes the protocol-native asset framework for
SunRey Coin and MoonRey Coin.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. Mainnet remains inactive.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

SunRey Coin and MoonRey Coin are native SunRey Chain protocol assets.
They are not ERC-20 tokens, Ethereum tokens, or third-party smart
contracts. This prompt does not introduce an EVM dependency.

Phase G Prompt 3 (wallet asset movement) is a parallel owner. This
prompt extends `packages/sunrey-chain` economics and native-assets
only. It does not replace wallets, Exchange matching, or the
application `packages/sunrey-coin` ledger.

## Canonical implementation

| Concern | Owner | Notes |
| --- | --- | --- |
| Protocol native-asset execution | `packages/sunrey-chain/rust/crates/native-assets` | Chunk 41 |
| Monetary constitution / mint gate | `packages/sunrey-chain/src/economics/issuance.ts` | Chunk 71 `authorizeIssuance` |
| Supply book | `packages/sunrey-chain/src/economics/supply.ts` | Singular `AssetSupplyBook` |
| Productized registry, policy, pipelines | `packages/sunrey-chain/src/native-assets/` | This prompt |
| Application SunRey Coin journals | `packages/sunrey-coin` | Distinct authority; unbridged |
| Oracle facts | `packages/sunrey-chain/src/oracle` | Facts are not money |
| Human contribution bridge | `packages/sunrey-chain/src/economics/human-contribution-bridge` | SunRey path |
| Productive value / GPUV | `packages/sunrey-chain/src/productive/policy-governance` | MoonRey path; GPUV is not MoonRey |
| Consumer BFF / Lovable | `services/api` `/api/v1/economy*` | Read-only |
| Agent | `packages/sunrey-agent` `getNative*` | Read-only |

Do not create `packages/moonrey-coin`, `packages/native-mint`,
`packages/licensing`, or an EVM token package.

## Supply authority

Total supply changes only through validated SunRey Chain protocol
transitions (`authorizeIssuance` / authorized burn) on
`AssetSupplyBook`. Exchange databases, frontends, Agents, oracles,
and operational databases cannot independently change supply.

Conservation:

`genesisAllocated + issuedPostGenesis - burned = circulating + locked + escrowed + feeReserved`

## Issuance controls

SunRey Coin conceptually follows:

verified contribution / economic input
→ valuation / economic engine
→ policy / governance validation
→ issuance proposal
→ authorized protocol transition
→ native asset supply update
→ evidence

MoonRey Coin conceptually follows:

verified productive observation
→ provenance
→ valuation methodology
→ oracle consensus / verification
→ economic policy
→ authorized issuance
→ protocol state
→ evidence

Raw user data, unverified contributions, AI valuation output, and a
single raw oracle response cannot mint. Mainnet economics are
`NOT_AUTHORIZED` and fail closed.

## Valuation versus market price

Protocol valuation inputs are not Exchange market prices. A
methodology that estimates economic or productive value does not
guarantee an Exchange price. The Lovable contract exposes last trade
only when the Exchange has one, labeled
`LAST_TRADE_NOT_GUARANTEED`.

## Agent and Lovable

Agent may explain both coins, retrieve supply, retrieve market price,
and retrieve approved metrics. Agent may not mint, burn, modify
policy, change supply, or declare a future price.

Lovable reads `/api/v1/economy`, `/api/v1/economy/supply`, and
`/api/v1/economy/assets/{id}`. Privileged issuance endpoints are not
exposed.

## Tests

Native-asset productization, Consumer BFF economy, Agent security,
and SDK contract suites in this prompt.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_5=true` after those suites, with
mainnet still inactive and economic parameters still human decisions.
