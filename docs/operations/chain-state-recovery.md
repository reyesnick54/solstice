# Chain-state recovery

Destroying one node's local chain state is recovered from a verified
snapshot:

- snapshot manifest
- state bytes
- height, block id, state root, protocol version

Hashes are verified after storage. Tampered or wrong-chain snapshots
are rejected. The restored node must sync finalized blocks until its
state root equals healthy validators.

```
sunrey-ops backup create
sunrey-ops backup verify
sunrey-ops dr run CHAIN_STATE_LOSS
```
