# Chunk 75 — SunRey / MoonRey dual-economy simulator

This laboratory models the economic system SunRey is being designed to
support:

- **SunRey Coin** = human economic layer
- **MoonRey Coin** = autonomous productive economy layer

It is an engineering and economic-analysis tool. It does **not** predict
token prices, promise investment returns, or activate production
monetary policy.

Canonical owner: `packages/sunrey-economics`.

## Consumed protocol surfaces

Chunk 76 reconciles this laboratory onto the final Chunk 71–74 owners
through `IntegratedEconomicStack`:

| Concern | Owner consumed |
| --- | --- |
| SunRey monetary policy | Chunk 71 `MonetaryIssuanceAuthority` + `AssetSupplyBook` |
| Validator economics | Chunk 72 `ValidatorEconomicsEngine` |
| Native fees / utilization | Chunk 73 `FeePolicyV2` / `FeeDispositionPolicyV2` |
| MoonRey productive issuance | Chunk 74 policy bundle + Chunk 44 engine, gated by Chunk 71 |
| Exchange price discovery | `packages/sunrey-exchange` matching (`SUNREY_COIN` / `MOONREY_COIN`) |
| Machine commerce | `packages/sunrey-chain/src/machine-economy` |
| Adversarial smokes | `packages/sunrey-range` (Chunk 57) + Chunk 76 stress lab |

MoonRey issuance never bypasses oracle quorum, freshness, conflict, or
fingerprint anti-duplication rules.

## Hard rules

- No `1 SunRey = N MoonRey` protocol peg
- Supplies are never merged
- Money remains integer minor units
- `ENVIRONMENT=simulation`, all `LIVE_*` flags stay false
- `moonreyIssuanceActivated()` stays `false`
- Simulation parameters never become production policy automatically
- Results are not future price forecasts

## Commands

```
npm run demo:sunrey-dual-economy
npm run sunrey-economics -- dual simulate --scenario baseline
npm run sunrey-economics -- dual compare --left baseline --right rapid-automation
```
