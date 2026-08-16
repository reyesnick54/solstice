# Chunk 47 — Institutional native-asset custody

Implemented on latest `main` after Chunk 45. Canonical owners stay:

- application custody: `packages/custody`
- blockchain / signer primitives: `packages/sunrey-chain`
- cryptographic infrastructure: `packages/security`

Do not create `packages/custody-v2`, `packages/blockchain-custody`,
`packages/institutional-custody-v2`, or `packages/hsm-security-v2`.

## What this chunk adds

Institutional control plane for SunRey Exchange, treasury, enterprise
clients, and institutional holders:

- `CustodyVault` with explicit wallet classifications
- segregated and omnibus models
- hot / warm / cold policy fixtures
- `InstitutionalSigningProvider` (LOCAL_DEVELOPMENT, REMOTE_SIGNER,
  HSM, KMS, MPC port, OFFLINE_COLD)
- HSM/KMS provider-neutral contract and development simulator
- deterministic approval and withdrawal policy
- destination registry with cooling and explicit address-change auth
- finalized-block deposit indexer
- withdrawal lifecycle including `SUBMISSION_UNKNOWN`
- transaction preview binding
- cold-signing packages
- rebalancing proposals (AI may propose, never sign or approve)
- exact reconciliation that never mutates on-chain holdings
- exchange custody port for Chunk 48
- emergency security controls and key-compromise workflow
- operator CLI `sunrey-custody`

Existing Chunk 30R deposit, screening, Travel Rule, kill-switch, and
`SUBMISSION_UNKNOWN` behavior remains. This chunk reuses it.

## Custody accounting

Canonical native-asset quantity exists on SunRey Blockchain. Custody
stores wallet mappings, attribution, holds, workflow state, and
expected settlements. Derived positions reconcile to on-chain holdings.
There is no second mutable asset ledger.

## Keys

Custody keys use purpose `WALLET_SIGNING` only. They stay distinct from
validator consensus, P2P, governance, Execution Authority, oracle, and
machine keys. HSM-class providers never export signing material.

MPC is a port. Implementation state is `PORT_ONLY`. Cryptography is not
faked.

## Development posture

Simulation only. `ENVIRONMENT` stays `simulation`. `LIVE_*` stays
false. Hot/warm/cold limits are engineering fixtures, not production
policy. Travel Rule and screening labels remain `RESEARCH_REQUIRED`.
This is not a licensed-custodian claim.
