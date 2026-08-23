# Phase F closure report

Closure identity (Prompt 5 of 5):

- Branch: `cursor/phase-f-agent-qualification-4690`
- SHA: `4987b41345479fa348b9ea073b054a237ebb7f5f`
- Follow-up PR: https://github.com/reyesnick54/solstice/pull/255
- CI: green on this SHA (10/10)
- Prompts 1–4 owners are on this tree after the `main` merge and unmash.

PHASE F does not mean SunRey is production ready.

PHASE F means the Agent platform can be treated as a **backend
production-release candidate**: Model Gateway, Agent runtime, memory,
tools, Action Cards, approvals, Execution Authority isolation, safety
invariants, evaluations, observability, kill switches, and a Lovable
backend contract exist in simulation. Live production remains disabled.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

`MODEL_GATEWAY_PRODUCTIZED=true`
`AGENT_RUNTIME_PRODUCTIZED=true`
`AGENT_MEMORY_PRODUCTIZED=true`
`AGENT_TOOL_RUNTIME_PRODUCTIZED=true`
`AGENT_FINANCIAL_PROPOSALS_PRODUCTIZED=true`
`AGENT_SAFETY_PLATFORM_PRODUCTIZED=true`
`LOVABLE_AGENT_BACKEND_READY=true`

`REAL_AI_PROVIDER_CONNECTED=false`
`LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED=false`

`READY_FOR_PHASE_G=true`

Do not begin Phase G from this report. This document only records Phase F.

## Executive summary

The Agent is safe to connect later only because privileged mutation is
kept off the model. Typed tools read canonical domains. Financial
actions become structured proposals. Humans approve. The Kernel still
sees an ActionIntent. Execution Authority stays outside the Agent. The
ledger is written only by authorized domain services.

Safety does not depend on one vendor's refusal. The same evaluation
suite runs against two fixture providers.

Prompts 1–4 (gateway, runtime/memory, tool runtime, conversational
actions) are present on this tree and share the same canonical owners:
`packages/ai-runtime`, `packages/sunrey-agent`, `packages/model-registry`,
and `services/api` consumer BFF. Qualification (Prompt 5) extends those
owners. It does not create a second Agent, eval platform, or kill-switch
package.

## Model Gateway

**SANDBOX_FUNCTIONAL / EXTERNAL_PROVIDER_REQUIRED.**
Owner: `packages/ai-runtime`. Providers: S3M (primary, simulated),
reserved Grok, LOCAL_TEST, plus Phase F fixture-B for model swap.
Routing stays in `AiRuntimeRouter`. Streaming is represented as
token/tool/card events on the Agent conversation stream. No real
network provider is connected.

## Model Registry

**PRODUCTIZED_INTERNAL.** Owner: `packages/model-registry`. Unapproved
models cannot be selected (`AGENT_CANNOT_SELECT_UNAPPROVED_MODEL`).

## Model routing

Deterministic policy + health + registry. Fallback is recorded as a
metric. Vendor outage degrades Agent UI only.

## Streaming

Conversation stream events: token, tool progress, Action Card,
error/degraded. First-token observation is simulation-only.

## Agent runtime

**SANDBOX_FUNCTIONAL.** Identity is owner/wallet/account bound. Mandates
are enforced by `UserAgentMandateEngine`. Conversational state persists
in `db/customer/migrations/V037__agent_runtime.sql` via
`packages/persistence/src/agent`. That store is not a ledger and is not
a production Agent database.

## Mandates

Budgets, destinations, assets, approval class, expiry, and
self-expansion refusal remain in force.

## Conversations

Open, chat, stream, close. Subject-scoped. Redacted logs.

## Memory

Classified writes. Eligible preferences may store. Authoritative
overrides (balance, KYC, approval power) are rejected. PEG remains a
separate read model (`packages/personal-economic-graph`).

## Context security

Context authorization is subject-scoped. External content cannot grant
tools. Secrets never enter inference.

## Tool runtime

Qualification catalog: 22 typed tools (`agent-tools.phase-f.v1`).
Canonical Tool Runtime catalog: 37 tools (`CANONICAL_TOOL_COUNT`).
Mutation tools create proposals only. `executesFinancialAction=false`.

## Financial tools

Payment, FX, Growth, portfolio, Exchange, and custody reads use
injected canonical-domain ports. Sandbox fixtures stand in for Phase E
branches that may not be merged.

## Action Cards

Payment, FX, Growth, and Exchange cards. Grounded explanations.
Immutable after approval.

## Proposals

Created only by the server-side Agent engine. Mandate-hash bound.

## Approvals

Human principal + step-up. Agent cannot self-approve.

## Execution integration

`humanExecute` builds a Kernel-bound path. Domain services record
completion. The Agent cannot mark complete.

## Explainability

`explainProposal` / Action Card text. Certainty is
`NONE_FABRICATED`. No hidden reasoning in the audit package.

## Safety invariants

20 machine-testable invariants. Automated in
`productization-invariants.test.ts`.

## Evaluations

Versioned framework `agent-eval.phase-f.v1`. Categories: FINANCIAL_QA,
ACCOUNT_INTERPRETATION, PAYMENTS, FX, GROW_MY_MONEY, PORTFOLIO,
EXCHANGE, CUSTODY, COMPLIANCE_BOUNDARIES, PRIVACY, PROMPT_INJECTION,
TOOL_USE, APPROVAL_SAFETY, HALLUCINATION, UNCERTAINTY, MULTILINGUAL,
OUTAGE_HANDLING.

## Red team

Automated adversarial scenario. Expected: zero unauthorized financial
executions.

## Observability

Requests, conversations, model calls/latency, tool calls/latency/
failures, proposals, approvals, execution outcomes, structured-output
failures, policy blocks, injection detections, model fallback, token
usage, estimated cost, Agent errors. No sensitive metric labels.

## Cost control

Max model/tool calls per turn, context/response size, per-user rate,
Agent budget. Graceful degradation.

## Latency

Simulation observations only. No production SLA.

## Kill switches

ALL_AGENT_USAGE, MODEL, TOOL, FINANCIAL_PROPOSAL_TOOLS, JURISDICTION,
SPECIFIC_AGENT. Server-side and auditable. Do not disable ordinary
account access.

## Human escalation

COMPLIANCE_QUESTION, FINANCIAL_DISPUTE, UNRESOLVED_PROVIDER_FAILURE,
AGENT_UNCERTAINTY, SUSPICIOUS_BEHAVIOR. Agent cannot resolve staff work.

## Lovable readiness

Backend-supported: AGENT_HOME, CHAT, STREAMING, TOOL_PROGRESS,
RICH_FINANCIAL_CARDS, GROWTH_PROPOSALS, PAYMENT_PROPOSALS, FX_PROPOSALS,
EXCHANGE_PROPOSALS, APPROVAL, STEP_UP, EXECUTION_STATUS, ACTION_CENTER,
MEMORY_PREFERENCES, AGENT_SETTINGS, PAUSE_REVOKE, ERROR_DEGRADED_STATES.

## External model dependencies

See `docs/productization/SUNREY_EXTERNAL_MODEL_READINESS.md`.

## P0 blockers

None for Phase F sandbox qualification.

Remaining before any live Agent:

1. Real model provider DPA, regional processing, and security review.
2. Durable Agent persistence and operational runbooks.
3. Counsel-confirmed corridor policy (still `RESEARCH_REQUIRED`).

## P1 blockers

1. Operator UI for kill switches (API exists; console is later).
2. Real-provider transport remains unconnected; fixture adapters only.
3. Counsel-confirmed corridor policy remains `RESEARCH_REQUIRED`.

## Current production flags

`ENVIRONMENT=simulation`

All `LIVE_*` flags remain `false`.

## Recommendation for Phase G

`READY_FOR_PHASE_G=true`

Phase G should productize remaining consumer/platform surfaces that are
not Agent-specific. It must not enable production or connect a live
model as a side effect.

## Domain classification

| Domain | Class |
| --- | --- |
| MODEL_GATEWAY | SANDBOX_FUNCTIONAL |
| AGENT_RUNTIME | SANDBOX_FUNCTIONAL |
| MEMORY | SANDBOX_FUNCTIONAL |
| TOOL_RUNTIME | SANDBOX_FUNCTIONAL |
| FINANCIAL_PROPOSALS | SANDBOX_FUNCTIONAL |
| ACTION_CENTER | SANDBOX_FUNCTIONAL |
| AGENT_SAFETY | PRODUCTIZED_INTERNAL |
| EVALUATION_PLATFORM | PRODUCTIZED_INTERNAL |

None of these are `PRODUCTION_READY_PENDING_EXTERNAL_GATES` or
`PREPRODUCTION_READY`. That would overstate the tree.
