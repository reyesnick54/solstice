# Consensus partition recovery

Safety is more important than availability.

## Equal 2+2 split

If A+B are partitioned from C+D and voting power is equal, neither
side can collect `>2/3`. Honest validators must not finalize
conflicting blocks. Liveness pauses until the network heals.

After reconnect:

1. Peers re-authenticate (P2P identity).
2. Round-state hints and vote retransmission resume gossip.
3. Validators may jump **forward** on `f+1` higher-round evidence.
   They never move height, finalized state, or signer state
   backwards.
4. The next valid `>2/3` precommit certificate finalizes one block
   at the stalled height.

## Asymmetric 3+1 split

If A+B+C remain connected they have quorum and may continue. The
isolated validator cannot finalize alone. On reconnect it verifies
commit certificates and catch-up blocks; it does not trust a peer's
advertised height.

## Operator actions

- Confirm `/finalized_height` on the majority side.
- Do not delete signer-safety or WAL files to "unstick" a node.
- Reconnect the isolated process with the same data directory.
- Watch `partition_recovery_time_ms` and `validator_sync_lag`.

## Chaos controls (development)

The in-process harness can kill, pause, restart, disconnect, delay,
drop, or duplicate consensus packets. It does not use external paid
infrastructure.
