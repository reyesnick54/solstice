# Chunk 38 — Networked SunRey BFT consensus

Status: **IMPLEMENTED** (development / simulation). Not a public
network, not production mainnet, not a staking product.

Owner: `packages/sunrey-chain` (`packages/sunrey-chain/node`).

Do not create `packages/consensus`, `packages/sunrey-consensus`,
`packages/tendermint`, or `packages/validators`.

## What this chunk does

Connects the Tendermint-family engine to the Chunk 35R P2P
development network so four independent validator processes can
propose, prevote, precommit, and finalize through authenticated
binary gossip.

After this chunk:

- `CONSENSUS` traffic is the highest-priority P2P channel, ahead of
  block sync and transaction gossip, with bounded queues and
  backpressure.
- Canonical messages are versioned binary (`ProposalAnnouncement`,
  `ProposalRequest`, `ProposalResponse`, `PrevoteMessage`,
  `PrecommitMessage`, `CommitAnnouncement`, `CommitRequest`,
  `CommitResponse`, `RoundStateHint`, `EvidenceAnnouncement`). JSON
  is not a consensus encoding.
- P2P node identity and validator voting identity are separate.
  Relays may forward votes; only a current-set consensus key can
  contribute voting power.
- A catching-up node verifies genesis, block links, and
  `CommitCertificate` objects. An unauthenticated remote height is
  not truth.
- Signer safety and the consensus WAL refuse conflicting signatures
  and refuse to move height / finalized state / signer state
  backwards.

## Development validator set

Chunk 36 stopped while `sunrey-p2p` was still `PLANNED`. That stop
is historical (`chunk-36-stop.md`). Chunk 38 implements the
development validator registry, integer voting power, and signer
safety required to network the engine. Public staking, slashing, and
MoonRey issuance remain unimplemented.

The four-validator fixture uses equal integer power `{A,B,C,D}=1`.
Quorum is `3P > 2N` (three of four).

## Safety over liveness

A 2+2 equal-power partition cannot obtain `>2/3`. Neither side
finalizes. After reconnect, consensus resumes. A 3+1 split may
continue on the majority side. Conflicting finality is refused.

## Commands

```
npm run demo:sunrey-validator-devnet
cargo test --manifest-path packages/sunrey-chain/node/Cargo.toml
```

See `docs/runbooks/four-validator-devnet.md` and
`docs/runbooks/consensus-partition-recovery.md`.

## Legal / product limits

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false. ADR-0017 / ADR-0018 legal confidence remains
`RESEARCH_REQUIRED`. No rule is `CONFIRMED_BY_COUNSEL`.
