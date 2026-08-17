# Runbook — storage migration

1. Take a verified snapshot and application backup.
2. Confirm the source is a development/test file store, not a production
   genesis candidate.
3. Run `sunrey-ops storage migrate`.
4. Confirm the report: height, block ID, state root, native supply, and
   validator set are equal.
5. Run `sunrey-ops storage verify` on the destination.
6. Keep the source until a restart drill succeeds.

Do not use this path to migrate testnet state into production genesis.
