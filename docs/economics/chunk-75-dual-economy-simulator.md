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

Standalone Chunk 71–74 laboratories are not present as separate packages
on `main`. This lab consumes the canonical implementations those chunks
would wrap:

| Concern | Owner consumed |
| --- | --- |
| SunRey monetary simulation | `packages/sunrey-coin` formula + development issuance parameters |
| Validator economics | Chunk 42 fee rewards + Chunk 36/39 validator accounting |
| Native fees / utilization | `packages/sunrey-chain/src/fees` (Chunk 42) |
| MoonRey productive issuance | `ProductiveEconomyEngine` (Chunk 44) + oracle facts (Chunk 43) |
| Exchange price discovery | `packages/sunrey-exchange` matching (`SUNREY_COIN` / `MOONREY_COIN`) |
| Machine commerce | `packages/sunrey-chain/src/machine-economy` |
| Adversarial smokes | `packages/sunrey-range` (Chunk 57) |

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
