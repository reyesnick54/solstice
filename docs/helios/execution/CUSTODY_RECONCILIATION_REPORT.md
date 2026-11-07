# Custody and Reconciliation Report (EXEC11 / EXEC12)

## Custody isolation (EXEC11)

Simulation custody provider candidates (`packages/custody/src/provider-candidate/`) remain fixture-only. `LIVE_CUSTODY_ENABLED=false` at compile time. Customer positions and travel-rule evidence do not bypass the canonical custody owner.

## Reconciliation (EXEC12)

`multi-asset/m24/reconciliation.ts` compares broker fills, custody positions, cash, fees, and settlement state. Discrepancies seal evidence and emit `MultiAssetReconciliationException`.

## Adversarial breaks

| Scenario | Expected |
|----------|----------|
| Broker filled, custody missing | `BROKER_FILL_CUSTODY_MISSING` break |
| Custody position without known fill | `CUSTODY_WITHOUT_FILL` break |
| T+1 settlement failure | `UNSETTLED_BREAK`; position not marked settled cash |

## Ledger posture

Reconciliation reads ledger balances; it does not post journals without Execution Authority.
