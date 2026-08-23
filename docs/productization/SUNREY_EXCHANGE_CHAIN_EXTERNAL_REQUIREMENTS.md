# SunRey Exchange / Chain external requirements

Phase G productizes Exchange and SunRey Chain **internally** in
simulation. That is not production activation.

`ENVIRONMENT=simulation`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`LIVE_EXCHANGE_ENABLED=false`
`MAINNET_ACTIVE=false`
`LIVE_NATIVE_ASSET_ISSUANCE_ENABLED=false`

Building mainnet software is not activating mainnet. Activation requires
a separate future authorized process. Placeholders cannot satisfy these
slots.

## SOFTWARE COMPLETE INTERNALLY

These exist in canonical owners and are sandbox-functional:

| Surface | Owner | Internal status |
| --- | --- | --- |
| Exchange core / matching | `packages/sunrey-exchange` | Deterministic matching, persistent ops book, consumer engine |
| Clearing / DVP settlement | `packages/sunrey-exchange` native clearing | Sandbox DVP, reservation, unused-reservation release |
| Surveillance detectors | `packages/market-surveillance` + Exchange ops | Deterministic alerts / case proposals |
| Market data APIs + stream status | Exchange consumer + BFF `/api/v1/exchange` | Snapshot-then-increment support; SANDBOX freshness |
| SunRey Chain runtime | `packages/sunrey-chain` | Testnet-deployable simulation runtime |
| Consensus / validators / RPC | `packages/sunrey-chain` | Validator lifecycle and RPC in simulation |
| Explorer | `packages/sunrey-chain` testnet explorer | Simulation lookup |
| Native assets / SunRey Coin / MoonRey Coin | Chain protocol + Exchange clearing | Technical productization; issuance remains governed |
| Wallets / deposits / withdrawals | Exchange clearing + `packages/custody` ports | Sandbox workflows |
| Agent Exchange proposal | `packages/sunrey-agent` conversation + Exchange BFF | Proposal only; Agent cannot self-approve |
| Lovable BFF / SDK | `services/api` + `packages/sunrey-sdk` | Public `/api/v1` contracts |

## EXTERNAL INPUT REQUIRED

These are **not** satisfied by fixtures, rehearsal hashes, or this
repository.

| Input | Why it is external | Current honesty |
| --- | --- | --- |
| Custody provider | Qualified custody is not a fixture adapter | `REAL_CUSTODY_CONNECTED=false` |
| Market-data vendor | Live/delayed feeds are not sandbox books | `REAL_MARKET_DATA_CONNECTED=false` |
| Oracle data | Productive fixtures are not live oracles | `REAL_ORACLE_DATA_CONNECTED=false` |
| Blockchain analytics | Provider-candidate adapters only | Not a monitored production network |
| Travel Rule network | Simulation Travel Rule is not membership | Withdrawal pending is a safe refuse |
| Banking / settlement | No live rails | `LIVE_*` stay false |
| Security audits | Internal red-team is not an external audit | Slot remains MISSING |
| Protocol audit | Not present | Slot remains MISSING |
| Penetration test | Range work is not a live pentest report | Slot remains MISSING |
| Validator operators | Testnet lifecycle is not operator acceptance | Slot remains MISSING |
| Production HSM / KMS | Development simulator is not a launch key | Slot remains MISSING |
| Regulators / licenses | Unknown corridors stay `RESEARCH_REQUIRED` | Do not mark `CONFIRMED_BY_COUNSEL` |
| Legal opinions | Counsel review is a human artifact | Slot remains MISSING |
| Operational staffing | On-call, surveillance desk, incident owners | Slot remains MISSING |
| Economic parameters | Chunk 71 remains the mint | Fixture packages cannot authorize production |
| Human governance signatures | Ceremony candidate is not MAINNET_ACTIVE | Slot remains MISSING |
| Genesis / mainnet ceremony approval | Separate future process | Building ≠ activating |

See `docs/productization/sunrey-mainnet-readiness-gate.json` and
`docs/productization/sunrey-exchange-production-gate.json`. Both
evaluate `passed: false`.
