# Chunk 36R — SunRey validator registry, lifecycle, and signer safety

Implemented after Chunks 32R–35R landed on `main`. The earlier
reservation is historical: [`chunk-36-stop.md`](./chunk-36-stop.md).

Canonical owner remains `packages/sunrey-chain`. Do not create
`packages/validators`, `packages/staking`, `packages/validator-v2`,
`packages/consensus-engine`, or `packages/tendermint`.

## What this chunk implements

- Versioned `ValidatorRecord` without private keys.
- Deterministic lifecycle: `CANDIDATE`, `BONDED`,
  `PENDING_ACTIVATION`, `ACTIVE`, `PENDING_EXIT`, `JAILED`,
  `TOMBSTONED`, `EXITED`. Undefined transitions are rejected with
  machine-readable reason codes and auditable events.
- Controller gate: `AI_AGENT`, `ROBOT`, and `DEVICE` cannot control
  a validator key, vote, activate, rotate, jail, restore, or change
  membership. AI may analyze health only.
- Key-role separation: consensus, P2P, governance, recovery, and
  optional reward address. Execution Authority, chain-operation,
  P2P identity, wallet, and oracle keys are refused as voting keys.
- Integer voting power with exact `1/3+` and `2/3+` helpers using
  `signed * 3 > total` and `signed * 3 > total * 2`.
- `SIMULATION_BOND` development accountability primitive. No
  customer fiat debit, no SunRey Coin stake, no MoonRey issuance.
- Deterministic `ValidatorSet` / version / hash (`sunrey.valset.v1`).
- Epoch-boundary transitions with an immutable in-epoch active set.
- Future-epoch consensus-key rotation and voluntary exit.
- Equivocation evidence objects for double proposal / prevote /
  precommit. No economic penalties (Chunk 39).
- Consensus signer port (`sign_proposal` / `sign_prevote` /
  `sign_precommit`) with canonical domain separation.
- Durable signer-safety store (atomic write) that survives restart.
- Signer-provider kinds: `LOCAL_DEVELOPMENT_SIGNER` implemented;
  remote / HSM / KMS / PQ-hybrid reserved.
- Four-validator development set (A–D) with unique consensus and
  P2P keys. Private keys are derived, never committed, and never
  printed by default.
- `sunrey-node validator` operator commands.

Protocol transaction authentication now resolves the CryptoSuite
and provider catalog instead of selecting Ed25519 in the protocol
module. Canonical signed envelopes are unchanged.

## What this chunk does not implement

- Networked BFT proposal / prevote / precommit engine (Chunk 37).
- Slashing or economic penalties (Chunk 39).
- Public staking, production validator set, mainnet, or MoonRey.
- Customer ledger journals from bonding.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false.
