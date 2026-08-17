# Backups

Classes and recovery strategies are defined in
`packages/sunrey-chain/src/ops/backup.ts`.

| Class | Recovery |
| --- | --- |
| BLOCKCHAIN_STATE | Verified snapshot manifest, state, height, block id, state root, protocol version |
| CONSENSUS_WAL | Replay; never rewind signer or finalized height |
| SIGNER_SAFETY | Encrypted, fenced, monotonic high-watermark restore |
| VALIDATOR_CONFIGURATION | Restore topology; no secrets |
| EXPLORER_INDEX | Optional. Prefer rebuild from chain |
| POSTGRES_APPLICATION_DATA | Encrypted logical dump, migrate, integrity, reconcile |
| CUSTODY_METADATA | Encrypted operational metadata. Chain remains quantity authority |
| ENCRYPTED_CONFIGURATION | Envelope with BACKUP_ENCRYPTION |

Commands:

```
sunrey-ops backup create
sunrey-ops backup verify
sunrey-ops backup restore
```

A backup is not healthy merely because upload succeeded. Verification
downloads/reads the object, checks the manifest and hashes, and
periodically runs a restore drill.

Storage ports: `LOCAL_FILESYSTEM` and `S3_COMPATIBLE_TEST_PROVIDER`.
Vendor credentials do not belong in source.
