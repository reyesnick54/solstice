# Network zones

Production-candidate zones:

- `PUBLIC_EDGE`
- `PUBLIC_RPC`
- `SENTRY`
- `VALIDATOR_PRIVATE`
- `SIGNER_PRIVATE`
- `CUSTODY_PRIVATE`
- `DATA_PRIVATE`
- `OPERATIONS_PRIVATE`
- `OBSERVABILITY`
- `BACKUP`

## Allowed paths

- public → RPC
- sentry → validator P2P
- validator → signer
- Exchange → custody API
- oracle collector → configured external source
- Explorer → finalized-data interface

## Forbidden by default

- public → signer
- public → validator administration
- RPC → HSM
- Explorer → custody signer
- relayer → governance signer

Unknown paths are denied.

## Egress

Consensus execution never performs arbitrary external network requests.
Allowed production egress classes belong to off-chain adapters:

- oracle collector sources
- compliance providers
- release infrastructure
- object-storage backup
- log / metrics export
- container-registry pull
- DNS resolution
