# Consumer settlement

Settlement remains canonical DVP. The consumer API only projects
status:

| View | Meaning |
| --- | --- |
| `TRADE_MATCHED` | Match recorded |
| `SETTLEMENT_PENDING` | Intent created or submitted |
| `SUBMISSION_UNKNOWN` | Provider/settlement state is ambiguous; do not duplicate |
| `FINALIZED` | Chain finality recorded |

`ConsumerTradeReceipt` binds the order, fills, configured fees,
settlement reference, chain finality reference, and market/policy
version. Deposits and withdrawals stay on canonical custody/wallet
controls.
