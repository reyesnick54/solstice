# Runbook — validator operator incidents

Simulation / rehearsal procedure. Not a claim of observed production.

## Incident types

- `NODE_FAILURE`
- `SIGNER_FAILURE`
- `KEY_COMPROMISE_SUSPECTED`
- `NETWORK_PARTITION`
- `STORAGE_CORRUPTION`
- `VERSION_MISMATCH`
- `DOUBLE_SIGN_EVIDENCE`
- `PROVIDER_OUTAGE`

## First actions

1. Open a `ValidatorIncident` on the assigned operator only.
2. Preserve evidence before replacement. Especially for
   `KEY_COMPROMISE_SUSPECTED`, `SIGNER_FAILURE`, and
   `DOUBLE_SIGN_EVIDENCE`.
3. Follow Chunk 54/64 key-compromise and signer-fencing runbooks.
4. Do not present monitoring suspicion as finalized misconduct.
5. Do not dual-activate a replacement signer.
6. Do not debit customer assets.
7. Do not bypass consensus safety to restore availability.

## Recovery kinds

- node loss
- disk loss
- sentry loss
- signer loss
- failure-domain loss

```
sunrey-ops validator incidents
sunrey-ops validator incidents open
sunrey-ops validator backup
sunrey-ops validator backup create
```

See [../operators/key-rotation.md](../operators/key-rotation.md) and
[validator-key-compromise.md](./validator-key-compromise.md).
