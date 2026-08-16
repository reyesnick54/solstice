# Runbook — exchange native settlement reconciliation

## Status lifecycle

`MATCHED` → `SETTLEMENT_CREATED` → `SUBMITTED` →
(`SUBMISSION_UNKNOWN`) → `FINALIZED` | `FAILED` |
`RECONCILIATION_REQUIRED`

Only BFT-finalized settlement changes final exchange position.

## Ambiguous submission

1. Keep the original settlement ID and transaction ID.
2. Query the chain by transaction ID.
3. If finalized, mark `FINALIZED` and issue the receipt.
4. If absent and the mempool/proposal is gone, mark
   `RECONCILIATION_REQUIRED`.
5. Never create a new settlement for the same trade until reconciled.

## Exact checks

Reconcile:

- custody wallet holdings
- exchange derived positions
- reserved orders
- pending settlements
- finalized settlements
- withdrawals
- trading fees
- network fees

Inconsistency is `INVESTIGATION_REQUIRED`. No automatic balance plugs.
No quantity is created to repair a mismatch.

## Failed reservation

If blockchain settlement rejects for insufficient reservation:

- no partial asset movement
- trade enters `RECONCILIATION_REQUIRED`
- do not submit a duplicate settlement
