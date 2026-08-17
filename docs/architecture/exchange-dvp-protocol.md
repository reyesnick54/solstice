# SunRey Exchange delivery-versus-payment protocol

Off-chain matching. On-chain atomic settlement.

## Intent

`ExchangeSettlementIntent` is the only instruction consensus accepts
for exchange DVP:

- `settlement_id`
- `trade_ids`
- `buyer` / `seller`
- `base_asset` / `base_quantity`
- `quote_asset` / `quote_quantity`
- fee legs (`TRADING_FEE`, `NETWORK_FEE`)
- custody accounts
- reservation references
- expiration height
- exchange signature
- policy version `sunrey.exchange.settlement.policy.v1`
- network, chain, nonce

## Authorization

Consensus verifies:

- issuer is `sunrey.exchange.settlement.authority`
- signature over the unsigned authority bytes
- registered exchange public key
- trade IDs, participants, asset quantities, fees
- reservation references
- expiration, network, chain
- unused settlement id and nonce

A user-signed payload is `WRONG_AUTHORITY`.

## Atomicity

Every leg commits or none do. Example:

- seller SunRey decreases 10, buyer SunRey increases 10
- buyer MoonRey decreases 25, seller MoonRey increases 25
- fees move by policy

Insufficient reservation rejects the whole settlement. No partial
asset movement.

## Batches

| Limit | Value |
| --- | --- |
| maximum trades | 64 |
| maximum bytes | 65,536 |
| maximum execution units | 10,000 |
| maximum asset legs | 256 |

`ATOMIC_ALL` applies only when every trade is independently reserved.
Otherwise use `INDIVIDUALLY_ATOMIC`.

## Replay

A trade quantity cannot settle twice. Consensus stores
`settlement_id`, `trade_id`, and `(issuer, nonce)`.

## Receipt

`TradeSettlementReceipt` binds trade ID, market, participants, price,
quantity, notional, both fee categories, settlement ID, blockchain
transaction ID, finalized height, block ID, and state root.
