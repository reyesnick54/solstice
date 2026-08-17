# SunRey events v1

Streaming events are convenience projections. Canonical state remains
the finalized blockchain and canonical exchange/custody state.

Transport: Server-Sent Events at `GET /v1/events`, or JSON replay with
`?format=json`.

## Version

`event_version: v1`

A protocol upgrade does not automatically change this event version.

## Subscriptions

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

Query: `GET /v1/events?subscribe=newFinalizedBlock,transactionStatus&cursor={opaque}`

## Resume

Clients reconnect with the last opaque `cursor` or a finalized height
encoded inside that cursor. Missing data is recovered from replay, not
trusted from a gap.

## Envelope

```json
{
  "event_version": "v1",
  "event_type": "newFinalizedBlock",
  "event_id": "evt_1",
  "cursor": "opaque",
  "finalized_height": "1",
  "occurred_at": "2026-01-01T00:00:00.000Z",
  "authority": "PROJECTION",
  "canonical_ref": { "block_id": "...", "transaction_id": "..." },
  "payload": {}
}
```

Clients verify critical transaction and block references independently
against `GET /v1/chain/transactions/{id}` and `GET /v1/chain/blocks/{height}`.
