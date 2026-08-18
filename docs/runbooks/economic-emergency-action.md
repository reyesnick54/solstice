# Runbook — economic emergency action

1. Open the incident (oracle, custody, Exchange, or validator compromise).
2. Select a permitted emergency class and a narrow scope.
3. Collect the configured security/human approval set for the exact
   package hash. AI cannot approve.
4. Run `sunrey-ops governance emergency`.
5. Record incident reference, action class, scope, authority, approvals,
   activation point, expiry or review height, evidence, and result.
6. Do not mint, rewrite supply, confiscate wallets, or rewrite history.
7. Restore the capability only with the required human authority after
   review. Expiry without authority leaves the restriction
   `EXPIRED_AWAITING_AUTHORITY`.
