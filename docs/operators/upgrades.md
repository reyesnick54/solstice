# Governed upgrades

Running a newer binary does not change consensus rules. Protocol
state changes only when an authorized UpgradePlan activates at a
defined height (Chunk 40).

```
sunrey-ops upgrade precheck
```

The precheck reports:

- current protocol version
- pending upgrade and activation height
- binary compatibility
- module hashes, codec, CryptoSuite, and state-migration support
- disk space
- snapshot availability
- signer compatibility

## Rolling testnet

A seven-validator rolling binary deployment keeps old rules active
before the activation height. The new binary does not auto-activate
the new protocol. Governed activation occurs at `H`. The network
retains quorum. A lagging node later catches up.
