# Runbook — Custody outage

Simulation / preproduction only.

1. Pause withdrawals (`WITHDRAWAL_HALT` / Exchange `WITHDRAWAL`). Human operator only.
2. Read-only balances remain available.
3. Do not treat custody maps as ledger balances.
4. HSM/signer failure uses signer failover. Control room cannot sign custody.
5. Wallet backlog drains after custody or chain recovers; do not drop operations.

Existing: `docs/runbooks/custody-security-event.md`, `docs/operations/signer-failover.md`.
