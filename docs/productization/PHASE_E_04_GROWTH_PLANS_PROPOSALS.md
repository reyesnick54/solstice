# Phase E Prompt 4 — Growth Plans, Forecasting, Scenarios, and Structured Financial Proposals

This is productization. It is not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`ENVIRONMENT=simulation`

Phase E Prompts 1–3 were running in parallel. This prompt extends the
canonical Growth Orchestrator owner. It does not create
`packages/growth-engine`, a second Kernel, a second Execution
Authority, or a second ledger.

## Canonical owner

| Concern | Owner | Path |
| --- | --- | --- |
| Planning-cycle GrowthPlan | `packages/platform` | `src/growth/types.ts` |
| Customer Growth Plan | `packages/platform` | `src/growth/product/` |
| Scenario engine | `packages/platform` | `src/growth/product/scenarios.ts` |
| Return assumptions | `packages/platform` | `src/growth/product/assumptions.ts` |
| Financial Proposal | `packages/platform` | `src/growth/product/proposal.ts` |
| Phase B approval mapping | `packages/permissions` | `src/approval.ts` via `proposal-lifecycle.ts` |
| Agent tool names | `packages/sunrey-agent` | `src/growth-tools.ts` |
| Consumer BFF | `services/api` | `src/consumer/grow.ts` |

The existing orchestrator `GrowthPlan` remains the mandate-cycle
planning snapshot (`CURRENT` / `STALE` / `SUPERSEDED`). The product
object the customer experiences as **Grow My Money** is
`ProductGrowthPlan`.

## Growth Plan

Statuses: `DRAFT`, `PROPOSED`, `ACTIVE`, `PAUSED`, `SUPERSEDED`,
`COMPLETED`, `CANCELLED`.

A plan records owner, goal references, starting snapshot, target,
horizon, risk profile, liquidity, structured components, catalog
assumptions, scenario analysis, fees, expiry, and version.

Components identify purpose, amount, risk, liquidity, fees,
dependencies, execution method, and required approval:

- cash reserve target
- recurring savings
- eligible investment allocation
- goal contribution
- rebalance / currency actions when present

Starting capital on the plan is the caller-supplied snapshot. The
ledger remains authoritative for posted money.

## Scenario model

Deterministic sleeves: `CONSERVATIVE`, `BASE`, `UPSIDE`.

Each projection includes:

- illustrated low / mid / high (never a single guaranteed number)
- time horizon
- uncertainty note
- risk
- possible-loss illustration
- fees
- assumption data/source date
- `guaranteedOutcome: false`
- `notAPromise: true`

When catalog assumptions are available, a seeded monthly sampler
(256 paths, default seed `0x53524e59`) publishes p10 / p50 / p90.
Share-of-paths language is not a real-world probability of loss or
of reaching a goal.

## Assumptions methodology

Return assumptions come only from
`SUNREY_SIMULATION_ASSUMPTION_CATALOG_V1`.

Supported simulation sleeves: USD and GBP × CONSERVATIVE / BALANCED /
GROWTH × 1–120 months.

An LLM cannot invent expected-return numbers. Missing currency,
horizon, or risk support is `UNAVAILABLE`. Cash-path illustrations
then use zero market return and still are not promises.

## Proposal model

`FinancialProposal` is the contract between the Growth Orchestrator,
Agent, UI, and later Execution Authority.

It includes proposal/plan/opportunity ids, action type, instrument,
accounts, amount, currency, expected effect + range, risk, fees,
liquidity, reason, alternatives, assumptions, structured explanation,
required approvals, frozen suitability, policy decision, Phase B
`approvalState`, product `status`, material-terms hash, expiry, and
`executionAuthorityId: null`.

`serverIssued: true` is set only by the server.

## Immutability and versioning

Once a proposal is presented (`READY` is the last editable product
status), material terms are frozen by hash.

A modification of amount, goal allocation, or permitted risk
selection creates a new proposal id/version and supersedes the old
one. The frontend cannot submit proposal JSON as if the server
issued it.

An approved proposal is never rewritten underneath the customer's
approval.

## Explainability

Every proposal carries structured fields. AI may later render them
in conversational language. It does not invent them:

- WHY THIS ACTION
- WHAT DATA SUPPORTS IT
- EXPECTED EFFECT
- WHAT COULD GO WRONG
- FEES
- LIQUIDITY
- ALTERNATIVES
- GOAL IMPACT
- RISKS
- DATA / ASSUMPTIONS

## Alternatives

Where meaningful, keep cash, move only part, use a lower-risk
option, or defer. One recommendation is never the only recorded
choice.

## Suitability and approval

A suitability/policy snapshot is frozen at proposal creation.

If material circumstances change (verification, restriction,
jurisdiction, risk, liquidity, horizon), approval fails closed with
`REVALIDATION_REQUIRED`.

Approval uses the Phase B state machine
(`packages/permissions` `transitionApproval`). Product statuses map
onto those states. `SUPERSEDED` is a product overlay recorded as
Phase B `CANCELLED`.

Approval still requires owner + capability checks. Step-up is
required for eligible investment allocations. An Agent cannot
approve. Approval does **not** issue Execution Authority and does
**not** post a journal.

## Fees

Known catalog sleeve fees are included in projections. Provider /
product fees are present and marked `ESTIMATE` when a live quote
does not exist. Fees are not omitted to improve illustrated results.

## Agent boundary

Tool names: `getGrowthPlan`, `getProposal`, `explainProposal`,
`requestProposalModification`, `compareAlternatives`.

The Agent consumes canonical structured proposals. Unknown proposal
ids are `FABRICATED_PROPOSAL_ID`. The Agent cannot execute.

`packages/agent` still cannot import `packages/platform`.
`packages/sunrey-agent` consumes a port only.

## Lovable UX contract

`sunrey.lovable.grow-my-money.v1`

```
I HAVE: $X
MY GOAL: $Y
TIME HORIZON: Z
RISK: ...

YOUR GROWTH PLAN
  Cash Reserve
  Investments
  Recurring Contributions
  Other Eligible Actions

Conservative / Base / Upside
  with explicit risk and uncertainty
```

Routes:

- `POST /api/v1/grow/plans`
- `GET /api/v1/grow/plans/:id`
- `GET /api/v1/grow/proposals`
- `GET /api/v1/grow/proposals/:id`
- `POST /api/v1/grow/proposals/:id/modify`
- `POST /api/v1/grow/proposals/:id/approve`
- `POST /api/v1/grow/proposals/:id/reject`

## Production posture

Production remains disabled. Grow My Money is a simulation
illustration path. It is not a licensed advice engine and not a
live investment execution path.
