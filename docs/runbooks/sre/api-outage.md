# Runbook — API outage

Simulation / preproduction only. `ENVIRONMENT` stays `simulation`.

1. Confirm the alert is `API_OUTAGE` or `HIGH_ERRORS` in the control-room read model.
2. Check platform API process health and recent structured logs (`requestId`, `correlationId`, `traceId`).
3. If authentication is the failing hop, keep money mutation paths refused. Do not bypass Kernel.
4. If the API process restarted, confirm idempotency keys still protect ledger posts.
5. Use degraded modes: Agent may be down; Money UI reads can continue if accounts/ledger are healthy.
6. Do not flip `LIVE_*` flags or invent a second gateway.
7. Open an incident (`DETECTED` → `INVESTIGATING`). Assign `INCIDENT_COMMANDER` as a role, not an improvised admin path.
8. Resolve only after API availability recovers and no ledger invariant failed.

Existing: `docs/operations/alerts.md`, `docs/runbooks/public-rpc-incident.md`.
