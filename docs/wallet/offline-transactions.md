# Offline transactions

A client may construct an `OfflineTransactionDraft` from sufficiently
fresh policy and network information. A draft is not authorization.

## Offline signing

Where the wallet class allows client-side signing, the signed payload
includes:

- network
- chain
- nonce / replay data
- fee authorization
- canonical transaction bytes

Signing uses the local secure-storage key handle. Master private keys
never leave the device through SunRey APIs.

## Stale-draft detection

Before submission the draft is revalidated against:

- account state
- nonce / replay state
- fee requirements
- delegation validity
- policy validity
- network
- chain

A stale draft is refused. Submission uses Chunk 93 RPC endpoint pools
and retries by canonical transaction ID.
