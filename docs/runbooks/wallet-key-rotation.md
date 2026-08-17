# Wallet key rotation runbook (development)

1. Unlock the local development keystore.
2. Authorize with the current active key or the defined recovery process.
3. Register the next key (`sunrey-wallet key-rotate <walletId> <currentKeyId> <nextLabel>`).
4. If an activation delay is set, status is `KEY_ROTATION_PENDING` until
   that height.
5. After activation the new key is `ACTIVE` and the previous key is
   `HISTORICAL` for new transactions.
6. Verify a previously finalized signature still verifies.

Rotation may add a hybrid or simulated PQ CryptoSuite. Downgrades are
rejected.
