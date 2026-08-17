# Database recovery

Application PostgreSQL data uses a logical dump strategy with
transaction consistency, BACKUP_ENCRYPTION, a manifest, and an
integrity hash.

After restore:

1. Apply migrations
2. Verify dump hashes
3. Reconcile ledger positions to custody metadata
4. Check event outbox/inbox pairing

No automatic financial balancing entries may be invented. A mismatch
is a halt, not a silent correction.

This repository does not claim external managed-service backups
unless they are actually configured.

```
sunrey-ops dr run DATABASE_LOSS
```
