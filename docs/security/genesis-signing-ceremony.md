# Genesis signing ceremony

Genesis authority signs an exact binding, not a generic
"approve any genesis" statement.

The binding digest covers:

- exact genesis candidate hash
- network ID
- chain ID
- protocol version
- validator-set hash
- asset-allocation manifest hash
- CryptoPolicy hash
- module hashes

Changing any field changes the digest. A valid signature over a
mutated genesis hash is rejected.

Rehearsal uses a placeholder candidate hash. That rehearsal is not a
production genesis event.

See `genesisBindingHash` and `CeremonySession.bindGenesisCandidate`
in `packages/security/src/ceremony/session.ts`.
