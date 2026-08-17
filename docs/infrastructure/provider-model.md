# Provider model

SunRey production infrastructure is provider-neutral. Consensus logic
is not coupled to a cloud vendor.

## Interface

`ProductionInfrastructureProvider` declares capabilities such as
compute, Kubernetes, object storage, secret manager, KMS, HSM, load
balancer, DNS, certificate manager, container registry, private
network, log export, metrics export, and database service.

`ProductionInfrastructureRegistry` records:

- `provider_id`
- `provider_type`
- `environment`
- supported capabilities
- region / failure-domain metadata
- credential `SecretReference`
- health
- verification status
- configuration version
- evidence references

## Adapters

| Type | Runtime |
| --- | --- |
| `LOCAL_INTEGRATION` | Fully executable in CI |
| `AWS` | Compiles and validates configuration without credentials |
| `AZURE` | Compiles and validates configuration without credentials |
| `GOOGLE_CLOUD` | Compiles and validates configuration without credentials |
| `KUBERNETES` | Compiles and validates configuration without credentials |
| `VAULT_OPENBAO` | Compiles and validates configuration without credentials |

Cloud adapters never import a vendor SDK in this chunk.
