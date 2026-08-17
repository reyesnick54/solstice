# Network configuration

Public configuration, secret references, and operator-local key handles
are separated. Committed YAML contains handles only.

## Profiles

| Profile | Votes | Validator keys | Governance keys | Public admin |
| --- | --- | --- | --- | --- |
| Validator | yes | yes | yes | no |
| Seed / sentry | no | no | no | no |
| Public RPC | no | no | no | no |
| Faucet | no | no | no | HTTP faucet only |
| Explorer | no | no | no | read-only HTTP |
| Relayer | no | no | no | no |

Validator networking is split into:

- consensus interface (loopback / private)
- sentry / peer interface
- operator-local interface (not public)

Public RPC exposes HTTP API, an event stream, and an Explorer source
API. It does not hold voting, governance, or custody HSM secrets.

## Ingress / TLS

`deploy/sunrey-testnet/k8s/ingress.yaml` terminates TLS with a standard
Ingress. Hosts are operator-configured. No commercial cloud or
certificate credential is hard-coded.

## SDK

Named network `SUNREY_TESTNET_1` carries chain ID, network ID, HRP
`srtst`, and configurable RPC / Explorer / faucet URLs.
