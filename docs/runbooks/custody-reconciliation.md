# Runbook — custody reconciliation

Simulation / development only.

Compare at least:

- on-chain wallet holdings
- custody wallet registry
- derived ownership attribution
- pending withdrawals
- asset locks / exchange reservations
- fees

Outcomes: `MATCHED`, `MISMATCH`, `INVESTIGATION_REQUIRED`.

Never automatically alter on-chain assets to force a match. A
`SUBMISSION_UNKNOWN` withdrawal is investigation, not a license to
broadcast a second transfer.

`sunrey-custody reconcile` prints the report. `autoAdjustedOnChain`
is always false.
