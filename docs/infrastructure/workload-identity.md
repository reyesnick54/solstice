# Workload identity

Each production service receives a distinct identity. There is no
shared global production service credential.

Services:

- validator
- sentry
- RPC
- Explorer
- Exchange
- custody
- oracle collector
- relayer
- monitoring
- backup
- release service

Access policies bind service identity, resource, operation,
environment, and network zone.

Examples:

- RPC can read public node state and cannot access the consensus signer
- Explorer can read finalized chain data and cannot mutate the chain
- Oracle collector can retrieve its source credential and cannot access
  custody HSM
