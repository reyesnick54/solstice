# HSM acceptance

Contract tests run against the local/sandbox HSM in CI:

- key generation
- public-key retrieval
- sign
- attestation retrieval
- key rotation
- key disable
- access denial
- audit event
- health

Real commercial HSM evidence remains external and unfilled.

## PQC

The harness records Ed25519, software ML-DSA suite registration, and
hybrid operational patterns. Hardware PQC stays
`HARDWARE_PROVIDER_UNCONFIRMED`. Software PQ support does not imply
HSM PQ support.
