# Provider credentials

Credentials are `SecretReference` values (`secret://provider/path`).
Raw secret values must never appear in:

- logs
- evidence bundles
- readiness reports
- candidate manifests
- pull-request output

`ProviderSession` binds provider, environment, credential reference,
workload identity, capabilities, configuration hash, and network
restrictions. It never stores a raw credential.

Workload bindings are least-privilege:

- oracle collector cannot use custody HSM
- Explorer cannot use KYC credentials
- RPC cannot use governance KMS
- case-management workers cannot use validator signers
- consensus execution has no general provider egress

Versioned provider definitions live at
`packages/sunrey-chain/src/provider-runtime/config/providers.v1.json`.
No credentials are stored in Git.
