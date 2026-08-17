# Custody activation and HSM posture

A custody activation record distinguishes:

- `SIMULATION_SIGNER`
- `SOFTWARE_SIGNER`
- `EXTERNAL_HSM_CONFIGURED`
- `EXTERNAL_HSM_VERIFIED`

Production-candidate regulated activation requires configured policy
evidence. Simulation or software signers do not satisfy a verified
external HSM claim.

## Withdrawal gate

Eligibility evaluates identity, screening, Travel Rule where
applicable, destination policy, velocity, risk, custody approval,
signing readiness, security controls, and jurisdiction policy.

One approver cannot satisfy dual control. Changed signed bytes after
approval invalidate authorization. `SUBMISSION_UNKNOWN` is preserved;
the same economic withdrawal is not submitted twice.

## Destinations

Destination states are `NEW`, `VERIFICATION_REQUIRED`, `APPROVED`,
`RESTRICTED`, and `REVOKED`. Approval is bound to the exact
chain, address, and network.

## Segregation and reconciliation

`CustodySegregationVerification` reconciles chain-native holdings,
vault attribution, customer ownership, Exchange obligations, pending
withdrawals, locked assets, and fees. Mismatches create an explicit
incident. There are no auto-balancing entries.

Security controls reuse `WITHDRAWAL_HALT`, `SIGNING_HALT`,
`HOT_VAULT_HALT`, and `ASSET_WITHDRAWAL_HALT`, and they integrate
external provider health.
