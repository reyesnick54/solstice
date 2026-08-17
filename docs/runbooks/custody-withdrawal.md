# Runbook — institutional custody withdrawal

Simulation / development only.

1. Confirm the source vault is `ACTIVE` and no `WITHDRAWAL_HALT`,
   `ASSET_WITHDRAWAL_HALT`, or applicable `HOT_VAULT_HALT` is set.
2. Confirm the destination is `APPROVED` and past any cooling height.
3. `sunrey-custody withdrawal request` evaluates asset, quantity,
   vault, destination history, screening, Travel Rule pack state,
   velocity, and approval threshold.
4. Workflow decision is one of `ELIGIBLE`,
   `ADDITIONAL_APPROVAL_REQUIRED`, `SECURITY_REVIEW`,
   `COMPLIANCE_REVIEW`, or `REJECTED`.
5. Human approvers satisfy the vault approval policy. AI cannot
   approve.
6. Run transaction simulation. Do not sign until preview bytes are
   approved.
7. Remote / HSM / cold signer signs the approved digest only.
8. Submit once. If the network response is ambiguous, the withdrawal
   becomes `SUBMISSION_UNKNOWN`. Query by transaction id. Do not sign a
   second economic withdrawal.
9. After BFT finality, recognize the result and reconcile.

Legal labels stay `RESEARCH_REQUIRED` unless counsel has confirmed a
pack. This runbook is not a legal conclusion.
