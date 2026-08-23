# Runbook — Validator failure

Simulation / preproduction only.

1. Confirm missed votes, signer unavailability, or peer isolation.
2. One consensus key cannot be live in two places. Use signer fencing.
3. Restore signer-safety backups only with operator authorization and monotonic watermarks.
4. Validator consensus keys are never reused and never appear in snapshots.
5. Safety (no conflicting finality) beats liveness.

Existing: `docs/runbooks/validator-operator-incident.md`, `docs/runbooks/validator-signer-safety.md`.
