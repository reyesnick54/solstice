# Runbook — agent security incident

1. Confirm the wallet, agent, and mandate IDs from `sunrey-agent activity` and `sunrey-agent audit`.
2. Revoke the specific mandate, action class, or delegated key. If the
   wallet is compromised, run a wallet kill: revoke all active
   financial-agent mandates for that wallet.
3. Treat pending unexecuted proposals as ineligible. Do not replay
   prior approvals.
4. Review safety events. Do not automatically loosen limits after
   losses or failures.
5. Confirm Compliance Kernel and wallet authorization records. Do not
   reconstruct a second ledger or rewrite chain history.
6. If prompt-injection or self-expansion was attempted, keep the
   refusal. That is the correct outcome.
