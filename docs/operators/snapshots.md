# Snapshots

An authenticated chain-state snapshot includes:

- height
- block ID
- state root
- protocol version
- validator-set reference
- snapshot manifest
- hashes

It does not include a validator private key.

```
sunrey-ops snapshot create
sunrey-ops snapshot verify
sunrey-ops snapshot restore
```

Before restore, verify the manifest, hashes, trusted finalized
height, state root, network, chain, and protocol compatibility.
Tampered or wrong-network snapshots are rejected.
