# Runbook — Payment unknown status

Simulation / preproduction only.

1. Treat `SUBMISSION_UNKNOWN` as unreconciled, not as success or failure.
2. Do not retry blindly. Idempotency and reconciliation come first.
3. Recovery requires all of: provider technically healthy, unknown backlog drained, reconciliation complete.
4. An incident does not close because a health endpoint turned green.
5. Same-currency transfers may remain available if only FX is degraded.

Existing: `docs/operations/chunk-156-sunrey-control-room.md`.
