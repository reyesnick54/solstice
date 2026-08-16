# Machine key compromise

Development runbook for Chunk 45. Simulation only.

## Symptom

A machine key is suspected compromised: unexpected purchase
attempts, reused nonce failures, or controller-reported loss of
device control.

## Immediate actions

1. Controller revokes the machine identity:

   `sunrey-node machine revoke <machineId> <controller> suspected_compromise`

2. Confirm future actions are rejected. Historical finalized
   transactions remain in the store.
3. Outstanding escrows move to `RECOVERY_HOLD`. They do not
   disappear.
4. Preserve evidence / audit records. Do not rewrite history.

## Recovery

1. Controller provisions a replacement key through authorized
   identity controls (`recover` / key rotation).
2. The old key remains unusable for new actions.
3. Controller resolves outstanding escrow under explicit policy:
   release unused quantity to the buyer, or preserve the lock
   pending dispute.
4. AI agents cannot bind the financial outcome of their own
   dispute.

## What not to do

- Do not reuse the compromised seed.
- Do not grant validator, governance, or Execution Authority keys
  to the replacement identity.
- Do not issue MoonRey as part of recovery.
- Do not convert SunRey Coin and MoonRey Coin.
