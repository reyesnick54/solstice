# HSM provider requirements

Canonical port: `HsmKmsProvider` in `packages/security/src/hsm-kms.ts`.

## Required capabilities

- generate a non-exportable key
- retrieve a public descriptor
- sign an approved digest
- key attestation metadata
- rotate / version a key
- disable a key
- health check
- capability query
- backup-reference metadata where supported
- audit-event reference

There is **no** generic export-private-key operation for a
production-class provider.

## Capability flags

`ED25519`, `ML_DSA`, `ML_KEM`, `SLH_DSA`, `HYBRID_SUPPORT`,
`NON_EXPORTABLE`, `ATTESTATION`, `MULTI_AUTH_ADMIN`,
`BACKUP_SUPPORTED`.

Capability declarations require evidence references in production.
CI simulator capabilities are labeled `SIMULATION`.

## PQC readiness

| Category | Meaning |
| --- | --- |
| `SOFTWARE_PROVIDER_AVAILABLE` | Chunk 60 standardized software PQC in development/testnet |
| `HARDWARE_PROVIDER_CONFIRMED` | external HSM PQC with actual provider evidence |
| `HARDWARE_PROVIDER_UNCONFIRMED` | no hardware PQC evidence; do not claim it |

The ceremony simulator reports software available and hardware
unconfirmed. It is not a certified HSM.
