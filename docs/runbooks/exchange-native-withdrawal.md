# Runbook — native-asset exchange withdrawal

Reuses canonical custody. Do not add a second withdrawal engine.

## Flow

1. Request withdrawal against derived `AVAILABLE` only.
2. Reserved order quantity, pending settlement, machine escrow, and
   another settlement cannot be withdrawn.
3. Custody policy, destination screening, Travel Rule pack, and Kernel
   authorization.
4. Sign and submit one blockchain transaction.
5. Wait for BFT finality.
6. Reconcile exchange, custody, and chain.

## Submission unknown

If broadcast times out:

1. Record `SUBMISSION_UNKNOWN` and the transaction ID.
2. Query the chain by that transaction ID.
3. Do not submit a second withdrawal for the same request.
4. Resolve to `FINALIZED` or remain under investigation.

## Failure

- Insufficient available: reject.
- Withdrawal kill switch: reject.
- Destination block: reject and open a case.
- Kernel refusal: return the decision unchanged.
