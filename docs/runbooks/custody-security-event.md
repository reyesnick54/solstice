# Runbook — custody security event

Simulation / development / production-candidate-disabled only.

1. Engage the applicable control: `WITHDRAWAL_HALT`, `SIGNING_HALT`,
   `HOT_VAULT_HALT`, or `ASSET_WITHDRAWAL_HALT`.
2. If an external HSM or custody provider is unhealthy, treat signing
   as not ready. Do not substitute a software signer for a required
   external HSM.
3. Leave in-flight withdrawals in their current state. If submission
   is ambiguous, keep `SUBMISSION_UNKNOWN` and query by transaction
   id. Do not create a second economic withdrawal.
4. Reconcile chain, vault attribution, Exchange positions, and fees.
   Record an incident on mismatch. Do not post auto-balancing
   entries.
5. Human or security authority is required to lift a halt.

This runbook is not a legal conclusion.
