# Pre-genesis shadow network

The shadow network is a production-like rehearsal environment with
isolated identity.

## What is the same

- Candidate V2 service roles and 7-validator topology
- Mainnet RC application artifact shape
- redb storage engine and PostgreSQL configuration shape
- Remote-signer fencing, sentry routing, and operator runbooks
- Oracle collector contract, Exchange/custody sandbox workflows

## What must differ

These are `EXPECTED_REHEARSAL_VARIANCE` and are recorded, not hidden:

- network ID, chain ID, address HRP
- genesis and validator/governance keys
- provider credentials
- customer-facing endpoints
- production authorization state

Shadow artifacts cannot authorize production genesis.
