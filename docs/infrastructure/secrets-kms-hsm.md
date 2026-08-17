# Secrets, KMS, and HSM

Business modules receive `SecretReference` values from
`packages/security`. Raw configuration-file secrets are not used where
a reference can be used.

## Secret classes

- `DATABASE_CREDENTIAL`
- `TLS_PRIVATE_KEY`
- `RPC_SERVICE_CREDENTIAL`
- `ORACLE_PROVIDER_CREDENTIAL`
- `RELEASE_SERVICE_CREDENTIAL`
- `BACKUP_ENCRYPTION_KEY`
- `HSM_AUTH_REFERENCE`
- `KMS_AUTH_REFERENCE`
- `CONTAINER_REGISTRY_CREDENTIAL`
- `EXTERNAL_PROVIDER_CREDENTIAL`

Validator consensus keys are never general service secrets.

## KMS

Canonical `HsmKmsProvider` operations: generate, public descriptor,
encrypt/decrypt where appropriate, sign where supported, rotate,
disable, metadata, attestation/evidence reference, and health.

There is no generic production private-key export.

## HSM readiness

- `SIMULATION_HSM`
- `SOFTWARE_SECURE_PROVIDER`
- `EXTERNAL_HSM_CONFIGURED_UNVERIFIED`
- `EXTERNAL_HSM_VERIFIED`

CI may only exercise the first two unless real external evidence
exists. An unverified HSM cannot become verified by software.

## PQC

Cloud KMS/HSM adapters report algorithm capabilities explicitly.
Classical signing does not imply ML-DSA or hybrid support. Hardware
PQC remains `HARDWARE_PROVIDER_UNCONFIRMED` unless a provider declares
it with evidence.
