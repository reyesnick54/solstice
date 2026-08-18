# Runbook — economic policy activation

1. Draft the `EconomicPolicyChangePackage` and canonical diff.
2. Bind formal, stress, simulation, readiness, and economic RC hashes.
3. Transfer the offline approval package (policy hash, release hash,
   activation coordinates, approval request, public signatures). No
   private keys.
4. Collect human fixture or ceremony approvals for the exact package hash.
5. Run `sunrey-ops governance preflight`.
6. Confirm validator readiness and observability during the pre-activation
   window.
7. Activate only at the scheduled height or epoch through existing
   Chunk 40 governance.
8. Run `sunrey-ops governance verify` and publish the public Explorer view.

Do not treat binary install as policy activation.
