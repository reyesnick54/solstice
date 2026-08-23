# Phase F Prompt 2 — SunRey Agent runtime, identity, mandates, conversations, and memory

Status: implemented as a product overlay on the canonical SunRey Agent.
Not a second Agent runtime. Not Execution Authority. Not the customer.

Environment remains `simulation`. All `LIVE_*` flags remain `false`.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

`SAFE_TO_PROCEED_TO_PHASE_F_PROMPT_3=true`

This prompt does not start Prompt 3.

## Canonical owner

| Concern | Owner | Path |
| --- | --- | --- |
| Agent identity, mandates, proposals | `packages/sunrey-agent` | `src/engine.ts` |
| Conversations, memory, context | `packages/sunrey-agent` | `src/runtime.ts` |
| AI Model Gateway / streaming | `packages/ai-runtime` | `src/runtime.ts` `inferStream` |
| Persistence | `packages/persistence` | `src/agent/` |
| Events | `packages/events` | `agent` namespace |
| Consumer BFF | `services/api` | `src/consumer/agent.ts` |

Do not create `packages/user-agent-v2`, `packages/agent-execution`,
`packages/conversation`, `packages/memory`, or `packages/model-gateway`.

Phase F Prompt 1 streaming was not present as a separate productization
doc. This prompt extends the existing AI Model Gateway with
`AiRuntime.inferStream`. S3M remains `streaming: false`; the gateway
chunks a completed inference. That is not a second gateway.

## Agent identity

Each Agent is a `UserAgent`:

- `agentId`, `ownerId`, `agentType`, `name`, `status`, `createdAt`
- `modelPolicy`, `toolPolicy`, `mandateId`, `jurisdiction`, `riskPolicy`
- `identityKind: SUNREY_AGENT`
- `isCustomer: false`
- `isExecutionAuthority: false`
- `receivesMasterKey: false`

The Agent is distinct from human user, service, and provider identity.

## Lifecycle

`CREATED` → `ACTIVE` → `PAUSED` / `RESTRICTED` / `REVOKED` → `ARCHIVED`

The owner may pause or revoke. Compliance may restrict. Potential
production mandate mode still respects `ENVIRONMENT=simulation`.

## Mandate model

Assist scopes define what the Agent may help with:

`READ_ACCOUNTS`, `ANALYZE_SPENDING`, `READ_PEG`, `READ_GOALS`,
`READ_PORTFOLIO`, `CREATE_PAYMENT_PROPOSAL`, `CREATE_FX_PROPOSAL`,
`CREATE_GROWTH_PROPOSAL`, `CREATE_INVESTMENT_PROPOSAL`,
`CREATE_EXCHANGE_PROPOSAL`, `MANAGE_NON_FINANCIAL_PREFERENCES`

Never mandate scopes: `DIRECT_LEDGER_WRITE`, `BYPASS_KERNEL`,
`SELF_APPROVE`, `MASTER_SIGNING_KEY`.

Execution remains the existing ProposalGate → Kernel path.

## Budget / limits

Proposal constraints on the mandate budget:

- maximum proposal amount
- daily proposal aggregate
- per-tool budget
- allowed currency / asset class
- jurisdiction
- UTC time windows

These constrain proposals. They do not override stricter product or
compliance controls.

## Conversation and messages

Persistent `AgentConversation` + `AgentMessage`.

Statuses: `ACTIVE`, `ARCHIVED`, `DELETED`, `REDACTED`.

Roles: `USER`, `AGENT`, `SYSTEM`, `TOOL`.

Hidden chain-of-thought is forbidden (`hiddenReasoning: false`).
Conversations are not financial records (`isFinancialRecord: false`).

## Short-term context

`assembleConversationContext` takes recent visible messages, the current
request, an optional PEG snapshot, tool results, and an active proposal
id. Lifetime history is not resent. Token budget defaults to 4000.

## Long-term memory

Categories: `USER_PREFERENCE`, `FINANCIAL_GOAL_REFERENCE`,
`COMMUNICATION_PREFERENCE`, `DECLARED_CONSTRAINT`,
`CONFIRMED_FACT_REFERENCE`.

Sources: user-declared, user-corrected, confirmed system fact, PEG
reference. Model speculation cannot become memory. PEG balances are not
copied into memory.

Customers may view, correct, delete user-editable memories, and disable
optional personalization. Operational audit records have separate
retention.

## PEG integration

The Agent reads financial state through a `PegReadPort`. PEG remains
the non-authoritative profile. Memory stores preferences such as
"explain in simple language." Goals and positions stay in PEG.

## Context authorization

Before data enters model context the runtime checks mandate assist
scope, owner, purpose, data class, personalization consent,
jurisdiction, and model policy. Secrets never enter context.

## Streaming

```
user message → authenticated BFF → mandate / lifecycle check
→ context assembly → AiRuntime.infer / inferStream
→ read/prepare tools only → streamed tokens
```

No mutating financial tool executes because generation requested it.
Agent text "Done." does not complete financial or execution state.

## Personalization and multilingual

Verbosity, display currency, BCP-47 language, explanation complexity.
These cannot alter financial mathematics or regulatory disclosures.
Messages are Unicode-safe. Arabic and English are both valid; language
is not hardcoded as authoritative legal translation.

## Events

`agent.created`, `agent.paused`, `agent.revoked`,
`conversation.created`, `message.received`, `message.completed`,
`memory.created`, `memory.changed`, `mandate.changed`.

Domain events in `packages/events` carry ids only
(`containsConversationContent: false`).

## Persistence

In-memory store snapshots hydrate after restart. File durable store:
`packages/persistence/src/agent/durable-store.ts`. PostgreSQL:
`db/customer/migrations/V037__agent_runtime.sql`.

## BFF / Lovable contract

| Screen | Route |
| --- | --- |
| Agent Home | `GET /api/v1/agents` |
| Agent settings | `GET/PATCH /api/v1/agents/{id}/settings` |
| Permissions | `GET /api/v1/agents/{id}/permissions` |
| Memory | `GET/POST /api/v1/agents/{id}/memories` |
| Conversation list | `GET/POST /api/v1/agents/{id}/conversations` |
| Conversation | `GET /api/v1/agents/{id}/conversations/{conversationId}` |
| Streaming chat | `POST .../messages?stream=1` |
| Pause / revoke | `POST /api/v1/agents/{id}/pause` / `revoke` |

Auth is Phase B Bearer. Sandbox persona: `agent_enabled` /
`sandbox.agent_enabled`.

## Privacy

Events and generic logs do not carry full conversation content.
Personalization memory is optional and user-controllable.
Operational records required for audit are not treated as
personalization.

Production remains disabled.
