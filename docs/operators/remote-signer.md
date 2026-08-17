# Remote signer

The validator application does not require direct private-key bytes.
The signer process holds the consensus key handle.

## Transport

Use an established authenticated encrypted transport:

- mTLS for remote hosts
- Unix-domain socket for same-host isolated mode

Do not invent custom transport cryptography.

## Authentication

An arbitrary host connecting to the signer endpoint cannot request
signatures. Sentry and public RPC identities are refused.

## Request policy

Before signing, the signer verifies network, chain, validator ID,
height, round, step, canonical bytes, CryptoSuite, and validator-set
context. Double-sign state is checked. Exactly one active lease may
exist for a consensus key.

## Commands

```
sunrey-ops signer status
```
