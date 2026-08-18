# Post-genesis health

Health checkpoints are protocol-native. They bind height, epoch, and
finalized state root.

Each configured checkpoint captures:

- validator participation, missed votes, proposer behavior, peer
  connectivity, restarts, catch-up, signer warnings, jail events, and
  bond state
- finality and state-root agreement
- peer and signer health
- storage growth: redb size, WAL/state growth, snapshot size, disk
  headroom
- database: primary, replica, replication lag, backup state, connection
  saturation, transaction failures
- RPC, Explorer, backup
- oracle health
- economic state
- open incidents

Conflicting-finality evidence is a critical protocol incident. It is
never masked as availability noise.

Backups are verified after configured stabilization milestones. Restore
validation uses non-production clones or snapshots and does not risk
the active network.
