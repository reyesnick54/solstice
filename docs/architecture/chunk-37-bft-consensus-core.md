# Chunk 37 — SunRey Tendermint-family BFT consensus core

This chunk implements a **development** Tendermint-class BFT engine
inside the canonical SunRey Chain Rust workspace.

It is not a production consensus deployment. It does not authorize a
public network, public staking, slashing, or mainnet.

## Owner

`packages/sunrey-chain/rust/crates/consensus`

Do not create `packages/tendermint`, `packages/cometbft`,
`packages/consensus-engine`, `packages/bft`, or
`packages/blockchain-consensus`.

## Algorithm

Lock, valid-value, NIL, and round-change rules follow Tendermint
Algorithm 1 (Buchman, Kwon, Milosevic, arXiv:1807.04938, 2018) and
the Tendermint Core / CometBFT specification. The implementation
note is `packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md`.

This is a constrained Rust engine, not a CometBFT library import.

## Flow

`NEW_HEIGHT → PROPOSE → PREVOTE → PRECOMMIT → COMMIT → FINALIZED`

Commit requires strictly more than two-thirds of active voting power
on the same non-NIL block ID. There is no longest-chain
reorganization.

## What this chunk implements

- `ConsensusEngine` with propose / receive_proposal / prevote /
  receive_prevote / precommit / receive_precommit / commit /
  apply_validator_set / submit_evidence / recover_from_wal
- Versioned consensus types and checked-integer quorum arithmetic
- Deterministic weighted proposer selection with persisted priority
- Proposal binding (network, chain, height, round, parent,
  validator-set hash, protocol version, consensus-parameter hash,
  proposer, signature)
- PREVOTE / PRECOMMIT for `BLOCK_ID` and `NIL`
- Lock / valid-value rules (not simplified)
- CommitCertificate independently verifiable against the validator set
- Persistent consensus WAL and FilePV-class signer safety
- In-process four-validator harness
- Safety, property, vector, and WAL recovery tests
- `sunrey-node consensus` read commands
- Consensus domain tags:
  `SUNREY_CONSENSUS_PROPOSAL_V1`,
  `SUNREY_CONSENSUS_PREVOTE_V1`,
  `SUNREY_CONSENSUS_PRECOMMIT_V1`,
  `SUNREY_CONSENSUS_COMMIT_V1`

## What this chunk does not implement

- Production BFT, public testnet, or mainnet
- Network-wide adversarial scenarios (Chunk 38)
- Full validator registry, bonding product, or slashing runtime
  (Chunk 36 / 36R). The engine consumes a development validator set
  through `apply_validator_set`.
- Fiat journal posting, Execution Authority, KYC, Consent, SunRey
  Coin mint outside native rules, MoonRey mint, AI, or external APIs

## Application boundary

Uncommitted proposals do not mutate authoritative application state.
Only `apply_finalized` commits an application transition.

## Status

Capability `blockchain-consensus` is `IMPLEMENTED` as a **development
engine**. `productionConsensusImplemented` remains false.
`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false. Legal confidence remains `RESEARCH_REQUIRED`.
