# Runbook — key rotation ceremony

Planned rotation records:

- current key
- future key
- effective epoch / height where applicable
- approvals
- attestation
- retirement state (`RETIRED_FOR_NEW_USE`)

The previous key must not sign new material. Historical signatures
remain verifiable.

High-impact rotations (release authority, root governance) require
multi-person human approval. AI cannot approve.

Use `sunrey-ceremony` in a simulation/rehearsal context only unless
an external production ceremony is separately evidenced.
