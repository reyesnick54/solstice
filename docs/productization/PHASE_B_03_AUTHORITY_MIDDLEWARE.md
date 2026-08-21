# Phase B Prompt 3 — Authorization, Kernel, and Execution Authority middleware

This is productization infrastructure. It is not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`ENVIRONMENT=simulation`

Phase A froze the authority model. This prompt extends the canonical
owners. It does not create `packages/authorization`, `packages/rbac`,
a second Kernel, or a second Execution Authority issuer.

## 1. Canonical middleware paths

| Concern | Owner | Path |
| --- | --- | --- |
| Authorization context | `packages/identity` | `src/authorization-context.ts` |
| Product capabilities | `packages/identity` | `src/product-capability.ts` |
| Resource ownership | `packages/identity` | `src/resource-ownership.ts` |
| Staff roles | `packages/identity` | `src/admin-roles.ts` |
| Client-safe denial | `packages/identity` | `src/client-denial.ts` |
| Frontend contract | `packages/identity` | `src/frontend-authority-contract.ts` |
| Proposal model | `packages/permissions` | `src/proposal.ts` |
| Approval state machine | `packages/permissions` | `src/approval.ts` |
| Execution Authority gate | `packages/permissions` | `src/execution-gate.ts` |
| Kernel submit adapter | `packages/kernel` | `src/middleware.ts` |
| Request orchestration | `packages/kernel` | `src/authority-pipeline.ts` |
| Agent safety hook | `packages/sunrey-agent` | `src/safety.ts` |

Representative test-only route (not a money-transfer API):

`GET /v1/authority/context`
`POST /v1/authority/rehearsal`

Handled by `AuthorityPipeline.handle`. Production remains disabled.

## 2. Authorization model

`AuthorizationContext` is derived server-side from Identity session,
device, KYC, grants, and a verified `ActorContext`.

It includes user, session, device, authentication strength, staff
roles, permissions, jurisdiction, KYC state, compliance/risk state,
requested capability, requested resource, and request metadata.

Privileged claims in a client body (`roles`, `permissions`,
`kycState`, `kernelDecision`, `executionAuthority`, and related
aliases) are rejected as `CLIENT_PRIVILEGE_REJECTED`.

Product capabilities (`ACCOUNT_READ`, `PAYMENT_CREATE`,
`PAYMENT_APPROVE`, `FX_QUOTE`, `CARD_MANAGE`, `INVESTMENT_PROPOSE`,
`INVESTMENT_EXECUTE`, `AGENT_USE`, `AGENT_ACTION_APPROVE`,
`EXCHANGE_TRADE`, `WITHDRAWAL_CREATE`, `DATA_CONSENT_MANAGE`,
`ADMIN_COMPLIANCE`, `AUTHORITY_PATH_REHEARSE`) map through existing
`IdentityCapability` values and `ACTION_TYPE_FOR_CAPABILITY`. UI
roles are not used in deep business logic.

A client-supplied `accountId` is never ownership proof.
`ResourceOwnershipRegistry.assertOwnedBySubject` is the server check
for account, wallet, portfolio, order, payment, Agent, conversation,
data object, device, and session.

## 3. Kernel integration

`evaluateThroughKernel` submits a canonical `ActionIntent` to
`ComplianceKernel.submit`. The enclosed `AuthorizationDecision` is
not reinterpreted.

Product-facing outcomes wrap Kernel statuses:

| Kernel status | Product outcome |
| --- | --- |
| `ALLOW` | `ALLOW` |
| `BLOCK` | `DENY` |
| `REQUIRE_MANUAL_REVIEW` | `REQUIRE_COMPLIANCE_REVIEW` |
| `DEFER` | `UNAVAILABLE` |

`REQUIRE_STEP_UP_AUTH` and `REQUIRE_APPROVAL` are product-layer
outcomes applied before or instead of Kernel submit when assurance
or Agent human-approval rules require them. They do not replace
Kernel statuses.

## 4. Proposal and approval

`ExecutionProposal` captures requester, Agent binding, action,
resources, amounts/assets, destination, risk/compliance reference,
created/expiry times, required approvals, authentication
requirement, policy decision reference, idempotency key, and
request/correlation identifiers.

Ordinary reads (`GET /v1/authority/context`) do not create a
proposal.

Approval states:

`DRAFT → PROPOSED → POLICY_REVIEW →`
`AWAITING_USER_APPROVAL | AWAITING_STEP_UP_AUTH | AWAITING_COMPLIANCE | APPROVED →`
`EXECUTING → EXECUTED`

Terminal: `REJECTED`, `EXPIRED`, `FAILED`, `CANCELLED`.

`transitionApproval` validates every move server-side.

`REHEARSE_AUTHORITY_PATH` is a TEST_ONLY action type. Execution
seals evidence only. It does not post a journal.

## 5. Execution Authority integration

`submitRegulatedCommand` is the only reusable mutation boundary
added here. It verifies:

- simulation environment
- proposal state `APPROVED` and not expired
- actor match
- authentication strength
- idempotency
- Kernel-issued authority via `AuthorityIssuer.verify`
- rejection of client-supplied authority

It does not call `AuthorityIssuer.issue`. The Kernel remains the
only issuer. No privileged Execution Authority endpoint is exposed
to Lovable.

## 6. Evidence

Sensitive outcomes seal into the canonical Evidence Vault:

- `AUTHORITY_CONTEXT_ISSUED`
- `AUTHORITY_UNAUTHENTICATED`
- `AUTHORITY_PERMISSION_DENIED`
- `AUTHORITY_RESOURCE_NOT_OWNED`
- `AUTHORITY_STEP_UP_REQUIRED`
- `AUTHORITY_KERNEL_DENIED`
- `AUTHORITY_CLIENT_PRIVILEGE_REJECTED`
- `AUTHORITY_APPROVAL_REQUIRED`
- `AUTHORITY_HUMAN_APPROVED`
- `AUTHORITY_AGENT_SELF_APPROVE`
- `AUTHORITY_REHEARSAL_EXECUTED`
- plus existing `KERNEL_DECISION`

Raw secrets, signatures, and passkey material are stripped before
seal. Ledger and provider references are reserved for later product
prompts.

## 7. Agent safety result

Human requester, Agent actor, mandate, proposal, and required human
approval are separate fields.

An Agent principal cannot hold `AGENT_ACTION_APPROVE` as if it were
the human user. `assertAgentCannotSelfApprove` and
`AuthorityPipeline.approveProposal` refuse Agent self-approval.

`ProposalGate` remains the only conversion from `AgentProposal` to
`ActionIntent`. Agent ALLOW still means “fit for a human to
consider.”

## 8. Frontend contract

The server owns state. The client displays:

| Display state | Meaning |
| --- | --- |
| `ALLOWED` | allowed immediately |
| `REQUIRES_APPROVAL` | needs human approval |
| `REQUIRES_MFA` | needs step-up authentication |
| `PENDING_COMPLIANCE` | pending compliance review |
| `DENIED` | denied |
| `EXPIRED` | expired |
| `UNAVAILABLE` | unavailable |

Denied responses use stable client-safe codes and do not leak
sanctions or internal rule details.

## 9. Admin contract

Staff roles `SUPPORT`, `COMPLIANCE_REVIEWER`, `TREASURY_OPERATOR`,
`EXCHANGE_SURVEILLANCE`, and `SECURITY_ADMINISTRATOR` map to
explicit `ADMIN_*` capabilities. They are never inferred from a
session. Grants remain auditable Identity capability grants. The
operations console is not implemented here.

## 10. Examples

Authenticated read:

`GET /v1/authority/context` + session → authorization context.

Regulated rehearsal (HIGH_ASSURANCE):

`POST /v1/authority/rehearsal` `{ resourceId, idempotencyKey }` →
ownership → capability → Kernel → Execution Authority verify →
evidence. No ledger write.

Agent rehearsal:

same POST with Agent principal headers →
`AWAITING_USER_APPROVAL`. The Agent cannot approve itself.

Frontend bypass:

a body containing `executionAuthority` is
`CLIENT_PRIVILEGE_REJECTED`.

## Safe for Prompt 4

Yes, as infrastructure only. Production remains disabled. Do not
begin Prompt 4 from this document.
