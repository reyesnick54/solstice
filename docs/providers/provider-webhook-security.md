# Provider webhook security

Every provider callback must satisfy:

- authentication
- provider identity
- signature where available
- timestamp
- nonce / reference
- replay protection
- idempotency
- schema validation

`WebhookReplayGuard` rejects:

- replayed nonces
- wrong provider signatures
- timestamps outside the replay window
- schema-version changes

Sensitive payloads remain protected. Only payload digests are recorded.
