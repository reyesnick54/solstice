# Machine commerce development

Development runbook for Chunk 45. Simulation only.

## Commands

```
sunrey-node machine register <id> <type> <controller>
sunrey-node machine show <id>
sunrey-node machine capabilities <id>
sunrey-node machine mandate <id>
sunrey-node machine offers
sunrey-node machine purchase <orderId>
sunrey-node machine escrow <orderId>
sunrey-node machine metering <sessionId>
sunrey-node machine delivery <proofId>
sunrey-node machine settlement <settlementId>
sunrey-node machine revoke <id> <controller> <reason>
```

TypeScript demos:

```
npm run demo:sunrey-machine-economy
```

Package-local:

```
npm run demo:machine-economy --workspace @solstice/sunrey-chain
```

## Compute scenario

AI buyer agent and GPU provider machine:

1. Register both identities.
2. Controller grants `PURCHASE_COMPUTE` and a bounded spending
   mandate.
3. Provider posts a compute offer.
4. Buyer purchases inside the mandate.
5. MoonRey development units lock in escrow.
6. Metering session starts.
7. Oracle network reports delivered GPU units.
8. Delivery proof finalizes.
9. Payment settles; unused escrow returns.
10. Productive contribution becomes eligible for separate
    evaluation. MoonRey is not issued here.
11. Four independent engines produce equal state roots.

## Energy scenario

An industrial facility buys energy from an automated power
resource. Settlement uses the configured native asset and never
auto-converts.

## Limit failure

A purchase that exceeds the mandate is rejected. No escrow. No
payment. The machine stays `ACTIVE`. The rejection is auditable.

## Boundaries

- Do not create a second exchange.
- Do not connect a live payment provider.
- Do not change `ENVIRONMENT` or any `LIVE_*` flag.
- Do not treat machine self-report as high-value settlement
  unless policy explicitly permits it.
