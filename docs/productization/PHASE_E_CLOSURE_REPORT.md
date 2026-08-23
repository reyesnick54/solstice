# Phase E closure report

PHASE E does not mean SunRey is production ready.

PHASE E means the repository now has a production-quality Grow My Money
backend in simulation: Personal Economic Graph, financial snapshot,
goals, risk/suitability facts, Growth Orchestrator, opportunity
discovery, portfolio/investment engine, Growth Plans, scenario
modeling, structured Financial Proposals, human approval with step-up,
Kernel-gated execution, sandbox Provider Runtime routing, Ledger-backed
paper settlement, evidence, recurring mandate foundation, and
monitoring that creates opportunities rather than silent trades.

No live brokerage, payment, or FX vendor is connected. Production
remains disabled.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

`PEG_PRODUCTIZED=true`
`GROWTH_ORCHESTRATOR_PRODUCTIZED=true`
`PORTFOLIO_ENGINE_PRODUCTIZED=true`
`GROWTH_PLAN_PRODUCTIZED=true`
`PROPOSAL_ENGINE_PRODUCTIZED=true`
`GROW_EXECUTION_PRODUCTIZED=true`
`LOVABLE_GROW_BACKEND_READY=true`

`REAL_INVESTMENT_PROVIDER_CONNECTED=false`
`LIVE_INVESTMENT_EXECUTION_ENABLED=false`

`READY_FOR_PHASE_F=true`

Do not begin Phase F in this report. Phase F is a subsequent program.

## Executive summary

Phase E extends canonical owners. It does not create a second ledger,
Kernel, Agent, Exchange, execution plane, or `packages/growth-engine`.

Planning lives in `packages/platform/src/grow` and
`packages/platform/src/growth`. Money movement stays in
`packages/investments` (Kernel-gated `openInvestmentAccount`,
`fundBrokerageCash`, `createPaperOrder`) and the existing payments/FX
owners. The Consumer BFF (`services/api/src/consumer/grow.ts`)
orchestrates after revalidation. Growth Orchestrator does not call
provider APIs, post journals, or issue Execution Authority.

Frontend-provided financial instructions are never trusted proposal
state. An Agent may create or request a proposal. An Agent cannot
self-approve or invoke privileged execution.

Scenario bands are labeled `PROJECTION`, `ESTIMATE`, `ASSUMPTION`, or
`ACTUAL_RESULT`. Achievement is never promised. Deposits are not
performance.

## Personal Economic Graph

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Owner: `packages/personal-economic-graph`.
Persistence: `packages/persistence` economic-graph store plus customer
migrations. Provenance is event-ingested and subject-bound. PEG is not
the Ledger. Snapshots are not authoritative balances (`ledgerWins:
true` on the BFF).

## Financial snapshot

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
`GET /api/v1/grow/snapshot` projects PEG goals, opportunities, income,
obligations, and liquid assets by currency. Result kind is
`ACTUAL_RESULT` for observed facts only. No yield field.

## Goals

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Goals are declared on the PEG (`declareGoal`) and listed through the
BFF. Creating a goal does not move money.

## Risk / suitability

**SANDBOX_FUNCTIONAL / REGULATORY_APPROVAL_REQUIRED.**
Grow suitability consumes facts (KYC, jurisdiction, restriction,
eligibility, risk class). It is not a second RiskEngine and not an
investor-suitability determination for a licensed advisor. Mismatch
blocks execution. Counsel has not confirmed any corridor.

## Opportunity discovery

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
PEG `proposeOpportunities` plus Growth Orchestrator detectors
(idle/surplus cash, emergency reserve, paper investment review).
Opportunities are not executable instructions.

## Growth Orchestrator

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Owner: `packages/platform`. Detectors emit ranked, eligibility-filtered
candidates. `investmentExecutionImplemented` remains a planning fact;
paper review is user-confirmation + Kernel. Ranking is deterministic
(`PLANNING_PRIORITY_V1`). Eligibility is mandate + policy port +
account state. The orchestrator cannot auto-trade.

## Portfolio

**SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED.**
Holdings, allocation, and risk snapshots come from
`packages/investments` after a paper fill. Performance read model
separates contributions from market movement.
`liveInvestmentExecution: false`.

## Investment engine

**SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED /
LICENSED_PARTNER_REQUIRED / REGULATORY_APPROVAL_REQUIRED.**
Paper brokerage only. Adapter status: simulation
`INVESTMENT.PAPER_ORDER` via Universal Provider Runtime (`sim-investments`).
Sandbox status: functional in approved non-production environments.
No silent fake-production fallback.

## Performance

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Read model compares planned vs executed contributions, withdrawals,
current value, fees, deviation, and time remaining.
`depositsAreNotPerformance: true`.

## Growth Plans

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Plans remain CURRENT or STALE. Accepted/executed plans may become
ACTIVE with funded/pending/completed/failed components. Recurring
automation is not perpetual authorization.

## Scenario engine

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Methodology: deterministic sandbox bands. Uncertainty is explicit.
Conservative band is a `PROJECTION`. Base band is an `ESTIMATE`.
Assumptions are listed. Achievement is never promised. No guaranteed
return, risk-free gain, or certain profit language.

## Financial proposals

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Server-owned, content-hashed, versioned. Modify amount supersedes the
prior version. Explainability includes why, why now, goal, facts,
suitability, and what could go wrong.
`canExecuteWithoutAuthority: false`.
`clientInstructionsTrusted: false`. TTL 30 minutes.

## Approvals

**SANDBOX_FUNCTIONAL / REGULATORY_APPROVAL_REQUIRED.**
Customer or human operator only. Step-up is required when the
candidate marks user confirmation. Agent self-approval is refused.
Approval binds proposal content hash and version.

## Execution

**SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED /
PRODUCTION_READY_PENDING_EXTERNAL_GATES.**
Canonical command references proposal, version, customer, approval,
authentication assurance, suitability, policy, idempotency, expiration,
financial resource, and intended action.

Immediately before execution the BFF revalidates expiry, supersession,
approval, auth strength, account status, funds, product, provider,
suitability, Kernel policy, compliance, and quote validity. Material
change refuses silently substituting a new action.

Routing: cash transfer → Payments; FX → FX; investment buy/sell →
Investment Execution; Exchange only when the product uses Exchange.

Funds reservation uses Kernel-gated `fundBrokerageCash` (canonical
Ledger journals). Provider Runtime selects a sandbox investment
provider. States: AUTHORIZED, QUEUED, SUBMITTED, PROCESSING,
PARTIALLY_COMPLETED, COMPLETED, FAILED, CANCELLED, REVERSED,
REQUIRES_REVIEW. Submitted is not completed.

## Recurring actions

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Foundation only. Each mandate records amount, frequency, source,
destination, start/end, limits, revocation, policy, and authorization
model `EACH_OCCURRENCE_REVALIDATED`. Agent cannot increase amount.
Revocation is not perpetual authority.

## Monitoring

**SANDBOX_FUNCTIONAL / PRODUCTIZED_INTERNAL.**
Cycles evaluate cash reserve, drift, and product availability.
Findings create opportunities/proposals. `silentInvestmentChange:
false`. Rebalance thresholds create a proposal, not an automatic trade.

## Agent readiness

Phase F tool hooks exist in `packages/sunrey-agent/src/grow-tools.ts`:

- `getFinancialSnapshot`
- `getGoals`
- `getOpportunities`
- `getGrowthPlan`
- `getPortfolio`
- `explainOpportunity`
- `createGrowthProposal`
- `modifyGrowthProposal`
- `submitProposalForApproval`
- `getExecutionStatus`

Privileged tools (`executeProposal`, `issueExecutionAuthority`,
`postJournal`, `selfApproveProposal`) are refused. `mayExecute` is
always false.

## BFF / SDK / Lovable

Consumer BFF `/api/v1/grow*` covers GROW HOME, GOALS, OPPORTUNITIES,
GROWTH PLAN, PROPOSAL DETAIL, APPROVAL, EXECUTION STATUS, PORTFOLIO,
PERFORMANCE, and PLAN PROGRESS. TypeScript SDK
`SunReyConsumerBffClient` exposes the same journey. Lovable must only
render structured server state and collect customer decisions.

OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`.

## Provider dependencies

Sandbox `sim-investments` is a LOCAL/SIMULATED registration. Real
brokerage, custody, market-data, payment, and FX providers are still
required for any live Grow execution. Provider lifecycle, health,
certification, jurisdiction, capabilities, and kill switch are
respected. Absence of a real provider does not become fake production.

## Regulatory dependencies

Investment advice, brokerage, custody, money transmission, and
cross-border corridors remain external. Unknown corridors stay
`RESEARCH_REQUIRED` and disabled. No rule is `CONFIRMED_BY_COUNSEL`.
This report is not legal advice.

## Testing

Automated sandbox Grow E2E (BFF), SDK-only Grow E2E, negative E2E
(ineligible, forge, agent self-approve, insufficient funds, expired
proposal, provider kill switch, recurring revoke), Grow unit tests,
and existing Phase C/D regressions remain the acceptance set.

## Performance

See `docs/productization/PHASE_E_PERFORMANCE_BASELINE.md`. No SLAs.

## P0 blockers

1. No real investment / brokerage / custody provider is connected.
2. `LIVE_INVESTMENT_EXECUTION` and all `LIVE_*` flags stay false.
3. Production activation remains forbidden pending external gates.

## P1 blockers

1. Licensed brokerage / RIA / custody partners are not selected.
2. Counsel-confirmed investor-suitability and corridor packs are absent.
3. Recurring contributions are a foundation, not a live ACH/rail loop.
4. Market hours, quotes, and corporate actions remain simulation fixtures.
5. Operator/compliance inspection UI is evidence-backed but not a
   licensed surveillance product.

## Current production flags

`ENVIRONMENT=simulation`
`LIVE_* = false`
`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Capability classification

| Capability | Classification |
| --- | --- |
| PEG | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |
| GROWTH_ORCHESTRATOR | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |
| PORTFOLIO | SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED |
| INVESTMENT_ENGINE | SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED / LICENSED_PARTNER_REQUIRED / REGULATORY_APPROVAL_REQUIRED |
| GROWTH_PLANS | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |
| SCENARIOS | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |
| PROPOSALS | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |
| EXECUTION | SANDBOX_FUNCTIONAL / PROVIDER_ADAPTER_REQUIRED / REGULATORY_APPROVAL_REQUIRED / PRODUCTION_READY_PENDING_EXTERNAL_GATES |
| MONITORING | PRODUCTIZED_INTERNAL / SANDBOX_FUNCTIONAL |

Do not describe any of the above as production live.

## Recommendation for Phase F

`READY_FOR_PHASE_F=true`

Phase F may begin Financial Agent productization against these hooks.
Phase F must not flip `PRODUCTION_READY`, `PRODUCTION_ACTIVE`, or
`LIVE_CONNECTIVITY_ENABLED`, must not let an Agent execute without
canonical approval and Execution Authority, and must not connect a
live vendor without the external/human gates above.
