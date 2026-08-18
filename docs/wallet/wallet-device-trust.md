# Wallet device trust

`WalletDeviceBinding` records device ID, wallet ID, a public descriptor,
platform class, registration state, trust state, first-registration
evidence, last-authentication metadata, and revocation state. It does
not collect unnecessary hardware fingerprinting.

Trust states are application security properties, not statements about a
person's worth or identity:

- `NEW`
- `VERIFIED`
- `TRUSTED`
- `RESTRICTED`
- `REVOKED`

Lost-device workflow: revoke the device, revoke its sessions, review
delegated keys and agent mandates, and initiate recovery or rotation if
required. Session revocation does not rewrite chain history.
