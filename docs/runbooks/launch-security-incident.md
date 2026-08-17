# Runbook — launch security incident

## Scenario

Suspected validator signing-key compromise during rehearsal.

## Actions

1. Detect the event and record it on `LaunchControlRoomState.incidents`.
2. Restrict signing for the affected validator.
3. Seal incident evidence. Do not delete prior evidence.
4. Run the replacement-key procedure with rehearsal identities only.
5. Notify `INCIDENT_COMMANDER`, `SECURITY_OPERATOR`, and
   `VALIDATOR_OPERATOR`.
6. Recover only after a single active signer is fenced and no
   equivocation is observed.

## Forbidden

- Using real production private keys
- Claiming the incident occurred on an active production network
- Impersonating human authorization with AI
- Enabling `LIVE_*` flags to "complete" recovery
