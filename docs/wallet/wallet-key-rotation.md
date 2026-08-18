# Wallet key rotation

`WalletKeyRotationPlan` binds:

- the old key
- the new public key
- the wallet
- the policy
- the authorization
- the activation state
- audit evidence

Rotation changes future signing authority. Historic signatures continue
to verify. The server accepts the new public key only.
