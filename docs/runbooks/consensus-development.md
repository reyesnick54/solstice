# Consensus development runbook

Simulation / local development only. This is not a production
validator or public-network runbook.

## Engine location

`packages/sunrey-chain/rust/crates/consensus`

## Four-validator harness

```bash
cd packages/sunrey-chain/rust
cargo run -p sunrey-rpc --bin sunrey-node -- consensus harness
```

Expected: validator A proposes; A/B/C (and D if present) prevote and
precommit; a `CommitCertificate` forms; height 1 finalizes. With D
unavailable, A/B/C still exceed 2/3 of equal power.

## Read APIs

```bash
sunrey-node consensus status --data-dir ./data
sunrey-node consensus validators --data-dir ./data
sunrey-node consensus params --data-dir ./data
sunrey-node consensus commit 1 --data-dir ./data
sunrey-node consensus wal-status --data-dir ./data
```

`--validator val_a` (default) selects the local signer identity used
to open the WAL and signer-safety files under
`<data-dir>/<validator>/`.

## Timeouts

`ConsensusParams` records bounded development timeouts
(`propose`, `prevote`, `precommit`, optional `commit_delay`).
Timeouts influence progress only. They do not change validation or
quorum rules.

## Crash recovery

The WAL records height, round, step, proposals, votes, locks, commits,
and signer-safety references. After restart, the node must not sign a
conflicting proposal, prevote, or precommit for the same
`(height, round)`.

## What operators must not do

- Do not treat a development certificate as production finality
- Do not enable `LIVE_*` flags or change `ENVIRONMENT`
- Do not expect this engine to post ledger journals or issue
  Execution Authority
- Do not run a public validator market

## Related

- Algorithm note: `packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md`
- ADR-0017
- Chunk 38 expands network-wide adversarial scenarios
