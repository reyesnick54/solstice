# SunRey incident response plan

Phase I Prompt 3. Extends Chunk 156 control-room incidents and Chunk 55 ops evidence.

This is not production authorization.

`ENVIRONMENT=simulation`
`PRODUCTION_ACTIVE=false`
`REAL_ALERT_PROVIDER_CONNECTED=false`

## Purpose

No system handling money should depend on operators improvising. Incidents are persistent resources with required fields, required states, and required runbooks.

## Persistent incident

Canonical implementation: `packages/sunrey-chain/src/ops/sre/incident.ts`.

Required fields:

- `incidentId`
- `severity` (`SEV1`–`SEV4`)
- `status`
- `commander` (role, not an invented name)
- `services`
- `startedAt` / `detectedAt` / `resolvedAt`
- `customerImpact`
- `timeline`
- `mitigations`
- `evidence`
- `postmortemReference`

## States

`DETECTED` → `INVESTIGATING` → `MITIGATING` → `MONITORING` → `RESOLVED` → `POSTMORTEM_REQUIRED` → `CLOSED`

Illegal transitions fail closed. Financial-integrity incidents require a recorded mitigation before `RESOLVED`.

## Severity

| Level | Maps to existing ops | Page | Expectation |
| --- | --- | --- | --- |
| SEV1 | CRITICAL | yes | Commander within 15 minutes |
| SEV2 | HIGH | yes | Investigate within 30 minutes |
| SEV3 | WARNING | no | Working-hours ticket |
| SEV4 | INFO | no | Record only |

## Control room

The control-room read model displays overall health, payments, providers, treasury, reconciliation, Agent, Exchange, Chain, custody, database, queues, security, and active incidents. It references domain-scoped kill switches. It cannot post journals, mint, issue Execution Authority, or engage a global off switch.

## Evidence

Seal incident metadata in the Evidence Vault. Logs and metrics are operational, not canonical financial evidence.

## Postmortem

Use `docs/productization/SUNREY_POSTMORTEM_TEMPLATE.md`. Systems, not blame.
