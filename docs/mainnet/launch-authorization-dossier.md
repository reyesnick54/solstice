# Launch authorization dossier

`LaunchAuthorizationDossier` is the human-readable and machine-readable
collection of evidence required for a future launch decision.

It does **not** execute a launch.

## Contents

- ceremony plan
- Mainnet RC and Candidate V2 verification
- validator count and evidence status
- HSM / PQC status
- CryptoPolicy
- genesis allocation status
- candidate / genesis hash
- transcript integrity
- external blockers
- human authorization state
- eligibility

## External blockers

Configured production policy shows absent evidence explicitly, including:

- `MISSING_EXTERNAL_SECURITY_REVIEW`
- `MISSING_HSM_EVIDENCE`
- `MISSING_LEGAL_APPROVAL`
- `MISSING_LICENSE`
- `MISSING_PROVIDER_AGREEMENT`
- `MISSING_HUMAN_AUTHORIZATION`

plus Candidate V2 / Mainnet RC absence, unapproved allocation, and open
HIGH/CRITICAL security limitations when those are the actual current
state.

`realProductionKeysCreated=false`. `mainnetEnabled=false`.
