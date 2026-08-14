# Compliance screening fabric

Canonical owner: `packages/kernel/src/compliance`.
Application facade: `services/compliance`.

This is the COMPLIANCE control architecture. It does not replace the
Compliance Kernel, the policy engine, Identity, or the Evidence Vault.

- Providers are ports. Simulation adapters only.
- Results are normalized (`CLEAR` / `REVIEW` / `HOLD` / `BLOCK` / `UNAVAILABLE`).
- Provider scores never authorize financial execution.
- Policy packs declare required screenings and outage posture.
- Kernel proofs escalate monotonically from those facts.
- Human operators decide cases. AI cannot finalize. Hard sanctions blocks
  cannot be generically overridden.
