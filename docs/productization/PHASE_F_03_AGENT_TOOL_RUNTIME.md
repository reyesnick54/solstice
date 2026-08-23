# Phase F Prompt 3 — Agent Tool Runtime and full SunRey product tooling

This is productization. It is not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`ENVIRONMENT=simulation`

Phase E closed Grow My Money (`READY_FOR_PHASE_F=true`). Chunk 98
(`packages/sunrey-agent`) and Chunk 101 (`packages/ai-runtime`) already
own mandates, ProposalGate, budget, and inference-plane tool intents.
This prompt productizes the missing **canonical Tool Runtime** so the
Financial Agent can use SunRey without inventing API calls.

Do not begin Prompt 4 in this document.

## Path

`MODEL → STRUCTURED TOOL CALL → TOOL RUNTIME → VALIDATION → MANDATE →
AUTHORIZATION → CANONICAL DOMAIN SERVICE → STRUCTURED TOOL RESULT →
MODEL`

Canonical owner: `packages/sunrey-agent`

| Concern | Path |
| --- | --- |
| Tool Registry | `packages/sunrey-agent/src/tools/registry.ts` |
| Catalog | `packages/sunrey-agent/src/tools/catalog.ts` |
| Runtime | `packages/sunrey-agent/src/tools/runtime.ts` |
| Schema / privileged-field reject | `packages/sunrey-agent/src/tools/schema.ts` |
| Authorization | `packages/sunrey-agent/src/tools/authorization.ts` |
| Loop guard | `packages/sunrey-agent/src/tools/loop-guard.ts` |
| Evidence | `packages/sunrey-agent/src/tools/evidence.ts` |
| Domain ports | `packages/sunrey-agent/src/tools/ports.ts` |
| Handlers | `packages/sunrey-agent/src/tools/handlers.ts` |
| Existing-tool audit | `packages/sunrey-agent/src/tools/audit.ts` |
| Reference flows | `packages/sunrey-agent/src/tools/reference-flows.ts` |
| Catalog HTTP | `GET /api/v1/agent/tools` |
| SDK adapter | `packages/sunrey-sdk/src/agent-tools.ts` |

`packages/tool-runtime` and `packages/agent-tools` remain forbidden
aliases. Domain `agent-tool.ts` files stay specialized adapters.

## Audit

| Surface | Class |
| --- | --- |
| New `AgentToolRegistry` | CANONICAL |
| Phase E `grow-tools.ts` / `growth-tools.ts` | INCOMPLETE / CANONICAL fabrication fence |
| Exchange, custody, consent, coin, HIN, surveillance agent-tools | CANONICAL specialized |
| Clean-room agent-tool | SIMULATION |
| AI runtime `RefuseExecuteToolIntentBroker` | CANONICAL inference plane |
| `packages/tool-runtime` | DEPRECATED / do not create |

## Safety

- Schema validation rejects unknown fields and floating-point money.
- Privileged model fields (`userId`, `KernelApproved`, `providerId`,
  `LedgerAccountOverride`, …) are server-derived and rejected.
- Read-only tools still require ownership, mandate, purpose, data
  class, jurisdiction, and product capability.
- Financial mutation is proposal-only. There is no
  `sendMoneyImmediately`.
- `createRecipientProposal` is registered and always
  `NOT_ELIGIBLE`. Agents cannot add beneficiaries.
- Mandate budget is evaluated before a proposal is treated as valid.
  Agent budget is not a substitute for product/customer limits.
- Per-turn loop limits: max 8 calls, max 2 identical hashes, max 3
  proposal creates.
- Prompt-injection text cannot change tool permissions.
- Tool results are `SUCCESS | ACTION_REQUIRED | APPROVAL_REQUIRED |
  NOT_ELIGIBLE | UNAVAILABLE | FAILED` with typed payload and
  `executed: false`.
- Authoritative numeric paths are marked
  `modelMayAlterAuthoritativeNumbers: false`.
- Evidence seals agent, owner, conversation, tool, version, input
  hash, redacted input, authorization, result reference, and timing.
- Production remains disabled. Tools do not call `postJournal` or
  issue Execution Authority.

## Lovable

Semantic component hints only: `ACCOUNT_CARD`, `PAYMENT_QUOTE`,
`FX_QUOTE`, `GROWTH_OPPORTUNITY`, `GROWTH_PROPOSAL`, `PORTFOLIO_CARD`,
`TRADE_PROPOSAL`, `APPROVAL_CARD`, `TRANSACTION_STATUS`.

Frontend does not invoke privileged tools.

`Lovable → Agent message API → Agent Runtime → Tool Runtime`

## Reference flows

| Flow | Utterance | Tools | Execution |
| --- | --- | --- | --- |
| A | How much money do I have? | `getFinancialSnapshot` | none |
| B | Send Ahmed 1,000 SAR. | recipients → quote → `createPaymentProposal` | none |
| C | What should I do with $10,000? | PEG spend → opportunities → `createGrowthProposal` | none |
| D | Buy SunRey Coin. | asset → price → `createExchangeOrderProposal` | none |

## Catalog

See [`SUNREY_AGENT_TOOL_CATALOG.md`](./SUNREY_AGENT_TOOL_CATALOG.md).
37 tools at version `1.0.0`.
