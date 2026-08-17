# Runbook — custody key compromise

Simulation / development only.

1. A human security or operations actor reports suspected compromise.
   AI cannot declare compromise or change security controls.
2. Signing is disabled on the handle. The vault status becomes
   `COMPROMISED`. Evidence is sealed.
3. Historical signatures are left unchanged. Do not rewrite them.
4. Rotate or replace the handle through the HSM/KMS port.
5. Create a destination/source migration plan: new deposit address,
   remaining on-chain quantity, pending withdrawals.
6. Reconcile derived attribution to on-chain holdings. Reconciliation
   never auto-moves native assets.

Consensus, P2P, governance, Execution Authority, oracle, and machine
keys are out of scope for this runbook. Those purposes cannot sign
custody withdrawals.
