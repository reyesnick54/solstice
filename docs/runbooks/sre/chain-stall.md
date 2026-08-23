# Runbook — Chain stall

Simulation / preproduction only.

1. Confirm finalized height, connected voting power, and `CHAIN_STALL`.
2. Application ledger banking may continue. Native asset movement waits on finality.
3. Restore from a verified snapshot only. Refuse unverified snapshot providers.
4. Genesis sync is the trusted path from height 0. Do not rewrite genesis.
5. Safe restart must not roll WAL, finalized height, or signer safety backwards.

Existing: `docs/operations/failure-domain-loss.md`, `docs/runbooks/consensus-partition-recovery.md`.
