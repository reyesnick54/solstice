# Chunk 48 — SunRey Exchange native-chain clearing and atomic settlement

Implemented on latest `main` after Chunks 41–45. Native assets, BFT
finality, and custody withdrawal safety already exist. This chunk
connects the canonical SunRey Exchange to sovereign SunRey Blockchain
settlement without creating a second exchange or a second asset ledger.

Canonical owners:

- Exchange: `packages/sunrey-exchange`
- Custody: `packages/custody`
- Blockchain: `packages/sunrey-chain`

Do not create `packages/exchange-v2`, `packages/sunrey-exchange-ledger`,
or `packages/moonrey-coin`.

## Architectural split

Matching, order entry, and market data stay in
`packages/sunrey-exchange`. SunRey Blockchain owns native-asset
ownership, locks, atomic settlement, BFT finality, and cryptographic
evidence.

## No second balance ledger

Exchange positions are derived:

| Component | Meaning |
| --- | --- |
| `FINALIZED` | BFT-finalized chain holdings attributed to the exchange account |
| `RESERVED` | open-order locks |
| `PENDING_SETTLEMENT` | submitted, not yet finalized |
| `AVAILABLE` | finalized available minus pending withdrawals |

Mempool receipt alone does not credit an exchange account.

## Native development market

`SUNREY_COIN` / `MOONREY_COIN` at
`market:sunrey-coin-moonrey-coin-native`. Public tickers remain
`NOT_ASSIGNED`. API and protocol use canonical asset IDs. Price,
quantity, notional, and fees are integer scaled units.

## Settlement

A match produces an immutable `Trade` and an
`ExchangeSettlementIntent`. The trade does not move native assets.
`EXCHANGE_SETTLEMENT` applies every leg atomically under a signed
exchange authority. Consensus rejects reused settlement IDs, trade IDs,
and nonces. Users cannot fabricate settlement instructions.

Finality is BFT. Pending proposal and finalized block are distinct.
There are no probabilistic confirmations.

## Withdrawals

Reuse the Chunk 30/47 custody path: available-position check, policy,
authorization, signing, submission, BFT finality, query-by-transaction
ID when submission is unknown. Never create a second settlement for the
same economic trade until state is reconciled.

## Demos

- TypeScript: `npm run demo:sunrey-exchange-native`
- Four-validator: `npm run demo:sunrey-exchange-settlement`
