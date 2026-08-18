# Production deployment topology

Provisioning maps each Candidate V2 validator into a failure domain,
`VALIDATOR_PRIVATE` zone, immutable artifact, redb storage profile,
sentry connections, remote-signer reference, monitoring target, and
backup class.

Sentries absorb public consensus exposure. Validators do not require
direct public inbound consensus. Remote signers live in `SIGNER_PRIVATE`.

Canonical Chunk 66 zones remain:

`PUBLIC_EDGE`, `PUBLIC_RPC`, `SENTRY`, `VALIDATOR_PRIVATE`,
`SIGNER_PRIVATE`, `CUSTODY_PRIVATE`, `DATA_PRIVATE`,
`OPERATIONS_PRIVATE`, `OBSERVABILITY`, `BACKUP`.

Default deny is authoritative.
