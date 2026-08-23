# Runbook — Database outage

Simulation / preproduction only.

1. Confirm `DATABASE_FAILURE` and persistence snapshot (`primaryHealthy`, replica lag, backup age).
2. Stop writers that require the writable primary. Kernel refusals are the correct outcome.
3. Do not invent balancing journals to "fix" missing rows.
4. Restore from the last verified encrypted dump onto an isolated target first (`runRestoreTest` pattern).
5. If PostgreSQL architecture is available, use local WAL archive PITR. Managed-cloud PITR is not claimed.
6. After restore: integrity hash, application smoke, ledger invariant checks, reconciliation. No invented journals.
7. Queue backlog (`QUEUE_BACKLOG`) drains only after the primary is healthy. Do not drop outbox events.

Existing: `docs/operations/database-recovery.md`, `docs/runbooks/database-pitr.md`.
