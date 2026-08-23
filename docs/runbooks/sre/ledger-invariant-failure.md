# Runbook — Ledger invariant failure

Simulation / preproduction only. This is a SEV1 financial-integrity incident.

1. Halt further mutation attempts on the affected book. Do not catch a Kernel refusal and continue.
2. Capture incident evidence through the Evidence Vault. Logs are not canonical financial evidence.
3. Do not edit or delete a posting. Corrections are new compensating journals with a new Execution Authority.
4. Record a mitigation before `RESOLVED`.
5. Restore from backup only onto an isolated target; never invent balancing entries during restore.
6. Production remains disabled. A restore drill passing is not production authorization.

Existing: `docs/operations/chunk-156-sunrey-control-room.md`.
