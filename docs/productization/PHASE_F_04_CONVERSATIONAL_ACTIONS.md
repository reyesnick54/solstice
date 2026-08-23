# Phase F Prompt 4 — Conversational financial actions

This record productizes the conversational action lifecycle that connects
Agent conversation to the structured proposal and approval architecture
from Phases B–E.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. The Agent never becomes the approver.

`SAFE_TO_PROCEED_TO_PHASE_F_PROMPT_5=true` after the conversational
lifecycle, Action Center, and adversarial suites in this prompt.

Phase F Prompts 1–3 (model gateway, Agent runtime, tool runtime) were
still in flight when this work started. This layer uses ports so those
runtimes can attach without replacing Action Cards or human approval.

## Owner

Canonical owner: `packages/sunrey-agent` (`src/conversation/`).

Orchestration: `services/api/src/consumer/conversation.ts`.

Lovable contract: `packages/sunrey-sdk/src/consumer-bff` plus
`api/sunrey-consumer-bff-v1.openapi.yaml`.

Do not create `packages/conversation`, `packages/action-center`,
`packages/agent-chat`, or a second Agent / Kernel / ledger.

Phase F Prompts 1–3 (model gateway, Agent runtime, tool runtime) were
still in flight when this prompt started. This layer uses ports so those
runtimes can be attached without replacing the Action Card, approval, or
Action Center contracts.

## Lifecycle

```
USER REQUEST
  → AGENT UNDERSTANDS INTENT          (routing metadata only)
  → APPROVED TOOLS                    (read / propose; never execute)
  → STRUCTURED FINANCIAL PROPOSAL     (server-issued)
  → AGENT EXPLAINS PROPOSAL           (grounded fields)
  → LOVABLE DISPLAYS ACTION CARD
  → USER MODIFIES / REJECTS / APPROVES
  → STEP-UP AUTH IF REQUIRED          (Phase B MFA / passkey, not chat)
  → KERNEL / COMPLIANCE REVALIDATION  (domain ports)
  → EXECUTION AUTHORITY               (domain owners only)
  → DOMAIN EXECUTION
  → STATUS UPDATES                    (conversation event stream)
  → AGENT EXPLAINS RESULT
```

Intent does not grant authority. A model reply is not approval.

## Intent

`CONVERSATION_INTENTS` in
`packages/sunrey-agent/src/conversation/taxonomy.ts`:

`INFORMATION_REQUEST`, `FINANCIAL_ANALYSIS`, `PAYMENT_REQUEST`,
`FX_REQUEST`, `GROWTH_REQUEST`, `INVESTMENT_REQUEST`,
`EXCHANGE_REQUEST`, `WITHDRAWAL_REQUEST`, `CARD_MANAGEMENT`,
`GOAL_MANAGEMENT`, `DATA_PERMISSION_REQUEST`, `SUPPORT_REQUEST`.

Classification is routing. It cannot open accounts, post journals, or
issue Execution Authority.

## Slot collection

Required slots are asked, never guessed.

Example: “Send Mark some money.” is missing recipient disambiguation,
amount, currency, and source account. The Agent asks only those
questions.

## Entity resolution

References such as “my savings”, “my USD account”, “Ahmed”, and
“my MoonRey holdings” resolve through a subject-bound catalog.

If more than one Mark exists, the Agent asks. It does not pick a
beneficiary. Cross-customer resources return `RESOURCE_NOT_OWNED`.

## Proposal creation

When slots are sufficient the Agent invokes a proposal tool. The server
issues `PaymentProposal` / `FinancialProposal` / `ExchangeOrderProposal`
equivalents as `DomainProposalRef`. Client-fabricated proposal JSON is
rejected (`clientFabricated: false`, `serverIssued: true`).

## Action Card

Client-safe resource `sunrey.consumer.action-card.v1`:

`actionId`, `proposalId`, `type`, `title`, `summary`, financial terms,
fees, risk, expiry, approval requirement, step-up requirement, status,
`availableActions`.

Types: `PAYMENT`, `FX`, `GROWTH`, `INVESTMENT`, `EXCHANGE`,
`WITHDRAWAL`, `CARD_CONTROL`.

## Available actions

The server, not Lovable, decides `APPROVE`, `MODIFY`, `REJECT`,
`CANCEL`, `ASK_AGENT`.

## Modification

“Make it 500 instead.” requests a server-side modification. A new
proposal version is issued. The previous proposal is `SUPERSEDED`.
Approved terms are not mutated.

## Approval

Approval is a human session event:

user, proposal/version, timestamp, session, device, authentication
assurance, acknowledgements.

The Agent cannot create this event. `originatedFromAgent: false`.

High-impact actions require explicit acknowledgement of amount,
destination, asset, fees, and risk. Conversational “Sure.” is not
enough.

## Step-up

When required the Agent explains that additional verification is
needed. Lovable launches the Phase B MFA / passkey flow. Secrets are
never typed into chat. On success the client retries approve with
`stepUpSatisfied: true`.

## Execution

After approval the BFF calls the domain execution port. Execution
Authority stays with Kernel / domain owners. The Agent only observes
status through safe tools and conversation events.

Production money movement stays disabled.

## Status streaming

`GET /api/v1/agent/conversations/{id}/events?after=` is the event
cursor. Lovable must not poll payments, FX, Grow, Exchange, Kernel, and
ledger separately.

Statuses: `PROPOSAL_CREATED`, `AWAITING_APPROVAL`, `AWAITING_STEP_UP`,
`APPROVED`, `PROCESSING`, `SUBMITTED`, `COMPLETED`, `FAILED`,
`ACTION_REQUIRED`, `REQUIRES_REVIEW`.

## Execution language

The Agent distinguishes proposal created vs approved vs submitted vs
completed. It never says “Your payment is complete” because a proposal
was created.

## Explainability

Grounded fields: WHY, WHAT WILL HAPPEN, AMOUNT, FEES, RATE, RISKS,
LIQUIDITY, TIMELINE ESTIMATE, ALTERNATIVES, WHY APPROVAL IS REQUIRED,
WHAT DATA WAS USED.

Unsupported numeric claims are refused. `inventedByModel: false`.

## Source attribution

Internal provenance is retained:

| Statement | Source | Client phrasing |
| --- | --- | --- |
| Balance | Ledger-backed Account Service | “Based on your current SunRey balances” |
| FX rate | Phase C FX quote | “a SunRey FX quote” |
| Investment price | Market data | “SunRey market data” |
| Growth assumptions | versioned scenario configuration | “a versioned growth scenario” |

Technical IDs are not required in customer prose.

## Uncertainty

`FACT` — current Ledger-backed balance, issued quote.
`ESTIMATE` — fees and settlement timing.
`PROJECTION` — growth scenarios.
`UNKNOWN` — missing provider rate.

Uncertainty is not rewritten as confident prose.

## Approval history and Action Center

Each action keeps proposal / modification / approval / execution /
outcome history.

```
GET /api/v1/agent/actions?view=AWAITING_APPROVAL|PROCESSING|COMPLETED|REJECTED|EXPIRED|REQUIRES_ATTENTION
GET /api/v1/agent/actions/{id}
```

Lovable screens: Awaiting Approval, Processing, Completed, Rejected,
Expired, Requires Attention.

## Notifications

Safe notifications omit amounts, destinations, and balances by default.

Kinds: proposal awaiting approval, execution completed, execution
failed, compliance review required, plan monitoring opportunity.

## Lovable interaction

| Capability | Route |
| --- | --- |
| Start conversation | `POST /api/v1/agent/conversations` |
| Send message | `POST /api/v1/agent/conversations/{id}/messages` |
| Stream events | `GET /api/v1/agent/conversations/{id}/events?after=` |
| Action Center | `GET /api/v1/agent/actions` |
| Action detail / explanation | `GET /api/v1/agent/actions/{id}` |
| Approve / modify / reject / cancel | `POST /api/v1/agent/actions/{id}/{approve\|modify\|reject\|cancel}` |

SDK: `startAgentConversation`, `sendAgentMessage`, `streamAgentEvents`,
`listAgentActions`, `approveAgentAction`, `modifyAgentAction`,
`rejectAgentAction`.

## Reference flows

- FLOW A — “Send Ahmed 1,000 SAR.” → resolve Ahmed → SAR source
  account → proposal → Action Card → step-up → approval → simulated
  payment → completed status.
- FLOW B — “I have $10,000. How should I grow it?” → snapshot /
  opportunities / plan / scenarios → proposal → modify 500 → approval
  → sandbox investment execution.
- FLOW C — “Convert $2,000 to Riyals.” → FX quote → Action Card →
  approval → execution.
- FLOW D — “Buy $500 of SunRey Coin.” → eligibility + market data →
  order proposal → approval → sandbox exchange execution.

Adversarial prompts (ignore all rules, self-approve, master key, fake
KYC, invent a rate, mark complete, ineligible buy, other user's
account) fail closed.

## Production posture

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`ENVIRONMENT=simulation`
