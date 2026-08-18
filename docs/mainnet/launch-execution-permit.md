# Launch execution permit

`LaunchExecutionPermit` is a single-use execution credential.

It binds the launch-plan hash, genesis hash, Mainnet RC hash, Candidate
V2 hash, network, chain, authorization set, validity window, and a
unique execution nonce.

Replay of a consumed permit cannot create a second independent
production genesis. Revocation is allowed only before genesis is
executed and requires a human actor.

See [chunk-88-genesis-execution.md](./chunk-88-genesis-execution.md).
