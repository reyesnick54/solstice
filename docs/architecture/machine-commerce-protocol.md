# Machine commerce protocol

Engine: `packages/sunrey-chain/src/machine-economy/engine.ts`.

Transaction family: `MACHINE_COMMERCE` (protocol id 14).

## Flow

1. Controller registers buyer and provider identities.
2. Controller grants explicit capabilities and mandates.
3. Provider posts a `MachineServiceOffer`.
4. Buyer submits a signed `MachineActionIntent` / purchase order.
5. Native units lock in machine escrow.
6. A `MeteringSession` starts.
7. Oracle facts (Chunk 43 port) report delivered quantity.
8. `MachineDeliveryProof` finalizes from verified facts.
9. Settlement pays the verified portion and releases unused escrow.
10. Delivery may be marked eligible for later productive evaluation.
    MoonRey is not issued by this path.

## Offers and orders

Offers describe provider, category, capacity, unit, price terms,
accepted assets, availability, location/jurisdiction, oracle and
metering requirements, and settlement conditions.

Purchase orders request resource, quantity, maximum price, delivery
window, metering method, settlement asset, and escrow.

## Matching port

`MachineMarketMatchingPort` supports:

- `DIRECT_BILATERAL`
- `EXCHANGE_ADAPTER` toward SunRey Exchange / future capacity markets

Typed future markets: compute capacity, energy, machine services,
productive capacity rights. There is no separate machine exchange.

## Escrow and settlement

Escrow uses the native asset lock port. State is deterministic:
`LOCKED`, `PARTIALLY_RELEASED`, `SETTLED`, `RELEASED_UNUSED`,
`DISPUTED`, `RECOVERY_HOLD`.

Settlement never converts SunRey Coin and MoonRey Coin.

Partial example: order 100, verified 72, pay 72, release remainder.

## Disputes

`MachineCommerceDispute` reasons: `DELIVERY_MISMATCH`,
`METER_CONFLICT`, `ORACLE_CONFLICT`,
`QUALITY_ATTESTATION_FAILURE`, `PAYMENT_CONDITION_FAILURE`.

Locked assets stay preserved. AI has no binding resolution authority.

## Observability

Metrics: `active_machine_identities`, `machine_transactions`,
`machine_transaction_rejections`, `machine_escrow_locked`,
`machine_settlement_volume_by_asset`, `machine_resource_volume`,
`machine_mandate_rejections`, `machine_revocations`,
`machine_disputes`, `machine_oracle_conflicts`.
