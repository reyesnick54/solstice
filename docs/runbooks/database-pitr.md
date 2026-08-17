# Runbook — application database PITR

1. Confirm no managed PITR provider is claimed unless independently
   evidenced.
2. Run `sunrey-ops database status` and `sunrey-ops database verify`.
3. For local/integration reproduction, run
   `sunrey-ops database restore-test`.
4. The drill restores chain storage, PostgreSQL dump, explorer rebuild,
   custody reconciliation, and exchange reconciliation.
5. Financial writes stay on PRIMARY. Do not post compensating journals
   to "fix" a restore.

Application PostgreSQL is not blockchain authority.
