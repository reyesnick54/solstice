# Runbook — storage corruption

1. Stop the node. Do not rewrite state with SQL or a hex editor.
2. Run `sunrey-ops storage verify`.
3. If checksum verification fails, treat the store as untrusted.
4. Restore from a verified Chunk 54/67 snapshot:
   `sunrey-ops storage restore`
5. Confirm height, block ID, and state root match the trusted
   finalized values.
6. Rebuild explorer indexes from the restored chain. Do not invent
   journals.

Never silently replace corrupted consensus data with defaults.
