# First-block verification

After authorized genesis, the engine records:

- first proposal (proposer, height, round, block ID, validator-set
  hash, state root)
- first commit (commit power and signatures under canonical quorum
  rules)
- first state root (healthy validators must converge)

If verification does not hold, the engine opens a high-severity launch
incident, preserves evidence, and does not synthesize success.

After the first production block is finalized, launch orchestration
must never model operational recovery as rewriting finalized history.

See [chunk-88-genesis-execution.md](./chunk-88-genesis-execution.md).
