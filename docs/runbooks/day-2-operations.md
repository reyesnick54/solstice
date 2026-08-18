# Runbook — day-2 operations

Daily / recurring:

- `sunrey-ops production inventory`
- `sunrey-ops production baseline` and compare configuration hashes
- `sunrey-ops production providers` for expiration reminders
- `sunrey-ops production backups` and scheduled restore drills
- `sunrey-ops production slo` for engineering targets
- `sunrey-ops production incidents` when a domain event occurs
- `sunrey-ops production changes` before any deployment

Validator maintenance uses Chunk 54 join, exit, key rotation, and
fencing. Consensus safety is preserved. Application rollback is not
chain-history rollback.

Protocol changes go through Chunk 40/79. Treasury cannot mint.
Regulated capabilities lose eligibility when required evidence expires.
