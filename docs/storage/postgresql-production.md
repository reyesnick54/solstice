# PostgreSQL production profile

Application PostgreSQL remains the durable adapter for Solstice
application state. It is **not** blockchain consensus authority and
**not** a second financial ledger.

## Production candidate

- TLS `verify-full` with certificate secret references
- credentials as `SECRET_REF` only (no inline production passwords)
- connection pooling and statement / lock / transaction timeouts
- migration control: migration ID, source/target schema, artifact hash,
  backup verification, compatibility, execution evidence
- backup metadata: source, height/schema, hash, encryption reference,
  retention, verification status

## Replication

Roles: `PRIMARY`, `SYNC_REPLICA`, `ASYNC_REPLICA`, `READ_REPLICA`.

Financial writes always route to PRIMARY. Read APIs must declare
acceptable consistency. Mutation eligibility must never depend on a
stale replica.

## PITR

Where no managed provider is configured, local WAL-archive reproduction
is the readiness model. This repository does **not** claim managed
cloud PITR exists.
