# RC upgrade and recovery rehearsal

## Governed upgrade

The rehearsal moves from the previous testnet software version to the
RC using the existing seven-validator rolling-upgrade path.

Verified:

- pre-upgrade blocks keep the old protocol
- new binaries do not auto-activate
- activation height is explicit
- protocol activates at that height
- state migration is `NONE` unless a migration is actually present
- a lagging node catches up
- artifact-hash verification remains required for operator rollout

Software release approval still does not activate protocol change.

## Snapshot / restore

A verified RC snapshot is created. One development validator's state
is destroyed, restored from the snapshot, and synced. The final state
root must equal healthy validators.

## Database recovery

Application persistence recovery reconciles Ledger, custody, events,
and Exchange derived state. No balancing entries are created merely
to force a match.

## Explorer rebuild

The Explorer projection is deleted and rebuilt from the finalized
chain. Public query outputs must be equivalent. The banner remains
`SUNREY TESTNET`.

## Multi-domain

Chunk 55 failure-domain topology is exercised for validator
unavailability, RPC failover, Explorer recovery, and relayer
redundancy. Safety invariants remain active. RPC cannot sign
consensus. Explorer cannot mutate the chain.
