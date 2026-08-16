# Wallet recovery runbook (development)

Use this only in the simulation environment.

1. Confirm the account has a `RecoveryPolicy` (`OWNER_RECOVERY_KEY`,
   `M_OF_N_RECOVERY_GUARDIANS`, `INSTITUTIONAL_RECOVERY`, or
   `HARDWARE_BACKUP`).
2. Collect the required recovery credentials. Guardians do not receive
   everyday spend.
3. Submit recovery authorization. Account status becomes
   `RECOVERY_PENDING`.
4. Wait until protocol height `H + delay`. Do not use wall-clock time
   for consensus behavior.
5. The owner may cancel during the delay only if `ownerMayCancel` is
   true.
6. At activation the new key becomes `ACTIVE` and the lost key becomes
   `HISTORICAL`. New transactions signed by the old key are rejected.
7. Historic signatures remain verifiable.

CLI:

```
sunrey-wallet recovery <walletId> request
sunrey-wallet recovery <walletId> cancel
```
