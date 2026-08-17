# Chunk 71 — SunRey dual-native-asset monetary constitution

Canonical owner: `packages/sunrey-chain/src/economics`.

This chunk defines how **SunRey Coin** and **MoonRey Coin** may be
created, allocated, issued, transferred, locked, escrowed, used for
fees, burned, audited, and governed. It does not invent production
tokenomics.

## Public names

- SunRey
- SunRey Blockchain
- SunRey Coin (`SUNREY_COIN`)
- MoonRey Coin (`MOONREY_COIN`)
- SunRey Exchange

Public tickers remain `NOT_ASSIGNED`. Production mainnet and
production economic activation remain unavailable.

## What this is not

- Not a second blockchain, native-asset ledger, Exchange, wallet,
  governance system, or genesis system.
- Not a human-worth score or social-credit system.
- Not an unrestricted mint.
- Not a decision of maximum supply, genesis percentages, or burn
  percentages.

## Policy states

`DRAFT`, `DEVELOPMENT_ACTIVE`, `TESTNET_ACTIVE`,
`PRODUCTION_CANDIDATE`, `SUPERSEDED`.

`PRODUCTION_CANDIDATE` does not activate production.

## Commands

```
npm run sunrey-economics -- policy show
npm run sunrey-economics -- policy verify
npm run sunrey-economics -- supply show
npm run sunrey-economics -- supply verify
npm run sunrey-economics -- simulate
```
