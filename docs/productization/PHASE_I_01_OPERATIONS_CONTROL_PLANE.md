# Phase I Prompt 1 — Operations control plane

Canonical staff operations platform. This is not the consumer Lovable UI
and it does not activate production.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`

## Audit

| Area | Classification | Owner |
| --- | --- | --- |
| Chain / validator ops, Chunk 156 control room | CANONICAL / SIMULATION_ONLY | `packages/sunrey-chain/src/ops` |
| Compliance cases / fabric | CANONICAL; default IN_MEMORY; PG snapshot exists | `packages/kernel/src/compliance` |
| Staff roles | INCOMPLETE before this prompt; now productized | `packages/identity` |
| Admin / internal HTTP | MISSING before this prompt | `services/api/src/internal` |
| Payment / treasury / surveillance / custody / agent ops | CANONICAL domain services; no staff console | existing owners |
| `packages/operations` / `packages/sunrey-ops` | FORBIDDEN | do not create |

This prompt extends the existing case owner (`packages/kernel`), staff
identity (`packages/identity`), persistence (`packages/persistence`), and
platform API (`services/api`). It does not create a parallel case system,
ledger, Kernel, or operations package.

## Platform path

| Layer | Path |
| --- | --- |
| Staff roles / SoD | `packages/identity/src/admin-roles.ts`, `packages/identity/src/staff` |
| Operational case + privileged actions | `packages/kernel/src/operations` |
| Persistence | `packages/persistence/src/operations-control`, `db/customer/migrations/V039__operations_control_plane.sql` |
| Internal HTTP | `packages/kernel/src/operations/http.ts` mounted conceptually at `/internal/v1`; `services/api/src/internal` is the consumer-BFF isolation contract only |
| Events | `OperationsCaseCreated`, `OperationsCaseAssigned`, `OperationsCaseEscalated`, `OperationsCaseResolved`, `OperationsOperatorAction`, `OperationsProviderDisabled`, `OperationsMarketHalted`, `OperationsAccountRestricted`, `OperationsSupportViewOpened` |

Specialized compliance cases (`SANCTIONS_REVIEW`, `AML_ALERT`, and the
existing `decideCase` machine) remain. Operational cases wrap or
reference them. Payment, treasury, and surveillance keep their own
status vocabularies.

## Privileged actions

Every staff mutation authenticates the operator, authorizes role and
capability, records a reason, validates the transition, requires
step-up where configured, requires a second approver where listed,
seals evidence, and emits an event.

Staff cannot:

- post a Ledger journal
- issue Execution Authority
- access custody private keys
- authorize production activation
- impersonate a customer for financial approval
- rewrite Agent evidence

Corrections use approved domain workflows. Operators never edit
balances.

## Internal API

`/internal/v1` is a separate surface from the consumer BFF. It is not
exposed to Lovable clients. Stronger auth, audit, and no-store headers
apply. See `SUNREY_OPERATIONS_ROLE_MATRIX.md`.

## Posture

Production remains disabled. Unknown corridors stay
`RESEARCH_REQUIRED`. No `LIVE_*` flag is changed.
