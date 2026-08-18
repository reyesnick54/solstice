# Provider runtime incident

Use this runbook when an executable provider integration fails.

## Immediate actions

1. Identify the provider domain and workload identity.
2. Read `ProviderHealthSnapshot` and circuit state. Do not treat
   `AUTH_FAILED` or `SCHEMA_INCOMPATIBLE` as a generic outage.
3. Confirm the runtime mode. Local-mock failures are not production
   outages.
4. Open a Chunk 90 `ProductionIncidentRecord` in the `PROVIDER` domain.

## Financial instructions

If a custody or banking instruction may have been submitted, record
`SUBMISSION_UNKNOWN`. Do not resubmit. Reconcile against the provider
transaction reference.

## Credentials

Rotate through `SecretReference` only. Do not paste secret values into
tickets, chat, or evidence.

## Approval boundary

Restoring connectivity is engineering work. It does not renew a
contract, license, or human acceptance. Expired Chunk 82 evidence still
blocks `PRODUCTION_AUTHORIZED`.
