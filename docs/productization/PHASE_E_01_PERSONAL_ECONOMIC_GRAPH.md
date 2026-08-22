# Phase E Prompt 1 — Personal Economic Graph

PHASE E does not mean SunRey is production ready.

This prompt productizes the canonical Personal Economic Graph as the
financial-intelligence profile used by Grow My Money. PEG is not the
Ledger. It consumes Ledger-backed state and user-declared assumptions.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`

## Canonical implementation

Owner: `packages/personal-economic-graph`
Facade: `services/economic-graph`
Service: `EconomicGraphService` at `packages/personal-economic-graph/src/service.ts`

Do not create `packages/economic-graph`, a second profile store, or a
parallel goal engine.

## Architecture

PEG is a subject-owned derived graph:

- PERSON, ACCOUNT, CASH, income, expenses, recurring obligations
- assets, liabilities, investments, digital assets
- goals, risk/suitability, preferences, restrictions
- household obligations only when the customer declares them
- jurisdiction and tax-relevant context only when supplied

Balances are projections of Ledger facts. `authoritativeBalance` is
always false. `ledgerWins` is always true.

## Provenance

Every material fact supports:

`source`, `sourceReference`, `observedAt`, `updatedAt`, `confidence`,
`verificationState`, `userDeclared`, `derived`, and `factKind`.

Fact kinds:

- `FACT` — source-backed (Ledger, payment, card, identity)
- `USER_DECLARATION`
- `DERIVED_INSIGHT`
- `AI_INFERENCE` (reserved; not used as suitability)

User-declared and derived facts cannot masquerade as AUTHORITATIVE.

## Persistence

PostgreSQL schema `economic_graph` (V009 + V034):

- graph, node, edge, fact, activity, opportunity, snapshot
- overlay (user classification corrections)
- account_currency
- insight
- suitability
- access_evidence
- history_point

In-memory store remains the runtime model. Persistence is export/import
of that state. Overlays survive rebuild and process restart.

## Financial Snapshot

`FinancialIntelligenceSnapshot` (`src/financial-snapshot.ts`) includes:

- cash, investments, assets, liabilities
- net position **by currency**
- monthly income, recurring expenses, discretionary cash flow
- liquidity, goals, risk profile, investment horizon
- currency exposure (not an FX-converted share)
- Phase C `PresentationValuation` when rates are supplied
- `crossCurrencyTotal: null`

Unlike currencies are never summed directly.

## Cash-flow analysis

`analyzeCashFlow` is deterministic. It recognizes income, recurring
income/expense patterns with `patternConfidence`, mandatory obligations,
discretionary spend, monthly surplus/deficit, a cash-reserve estimate,
and upcoming known obligations. Users can correct mistaken
classifications through `/api/v1/grow/classifications`.

## Goals

Kinds include `EMERGENCY_FUND`, `HOME`, `EDUCATION`, `RETIREMENT`,
`TRAVEL`, `BUSINESS`, `WEALTH_TARGET`, `CUSTOM`, plus historical aliases.
Lifecycle: `ACTIVE`, `PAUSED`, `ACHIEVED`, `CANCELLED`.

Users cannot edit Ledger-backed cash by declaring a goal or assumption.

## Risk / suitability

`assessSuitability` is deterministic questionnaire logic. It separates
tolerance, capacity, horizon, liquidity need, experience, loss
sensitivity, concentration, and jurisdictional eligibility. Capacity and
horizon may only tighten displayed tolerance. An LLM must not fabricate
these scores.

## Insights

Deterministic observations only. Prompt 2 owns opportunity discovery.

Types: high idle cash, insufficient emergency reserve, high
concentration, large recurring expense, cash-flow deficit, unused
surplus, goal funding gap, currency concentration.

Each insight has `insightId`, `type`, `severity`, `evidence`,
`calculatedAt`, `inputs`, and `confidence`. `recommendation` is null.

## Update pipeline and rebuild

`PegUpdatePipeline` uses Phase B `PersistentJobQueue` job types
`PEG_INGEST_EVENT`, `PEG_REFRESH_SNAPSHOT`, and `PEG_REBUILD`.

API reads do not rebuild the graph synchronously. Rebuild replays
canonical source events, keeps user-declared nodes, and re-derives
insights. Silent divergence is treated as a defect.

## Historical snapshots

Compact series: `NET_POSITION`, `CASH_FLOW`, `GOAL_PROGRESS`,
`PORTFOLIO_PROGRESS`. Not a second raw transaction store.

## Privacy and Agent access

PEG belongs to the authenticated subject.

- Customer self-read: `VIEW_ECONOMIC_GRAPH`
- Customer declare: `DECLARE_ECONOMIC_FACT`
- Admin/operate: `OPERATE_ECONOMIC_GRAPH` (explicit)
- Agent: empty default categories; a grow mandate must list categories
- Consent purpose `PERSONAL_ECONOMIC_GRAPH_DERIVATION` / `PERSONAL_AGENT_ANALYSIS`

Retention is configurable: regulated-operational vs optional
personalization (`DEFAULT_RETENTION_POLICY`).

Access evidence is sealed on Agent reads.

## API / BFF / SDK / Lovable

Client-safe routes on Consumer BFF `/api/v1`:

| Route | Use |
| --- | --- |
| `GET /api/v1/grow/profile` | Your Financial Profile |
| `GET /api/v1/grow/snapshot` | Snapshot |
| `GET/POST /api/v1/grow/goals` `PATCH /api/v1/grow/goals/:id` | Goals |
| `GET /api/v1/grow/insights` | Insights |
| `GET/POST /api/v1/grow/suitability` | Risk profile |
| `POST /api/v1/grow/assumptions` | User-editable assumptions |
| `POST /api/v1/grow/classifications` | Classification correction |
| `GET /api/v1/grow/history` | History series |
| `GET /api/v1/grow/agent` | Agent-scoped read (denied without mandate) |

SDK: `@solstice/sunrey-sdk/consumer` BFF client grow methods.

Lovable renders server values. It does not calculate balances or treat
projections as certainties.

## Sandbox personas

Simulation-only PEG seeds: `NEW_USER`, `HEALTHY_SAVER`, `HIGH_IDLE_CASH`,
`HIGH_SPENDER`, `INVESTOR`, `MULTI_CURRENCY_USER`, `GOAL_ORIENTED_USER`,
`LIQUIDITY_CONSTRAINED_USER`, `HIGH_CONCENTRATION_USER`.

BFF tokens: `sandbox.grow_*`.

## Remaining dependencies

- Live account/investment event wiring in production jobs (simulation
  ingest is implemented)
- Live FX rates for presentation valuation (`PROVIDER_ADAPTER_REQUIRED`)
- Counsel review of consent legal hooks (`RESEARCH_REQUIRED`)
- Prompt 2 opportunity discovery and growth recommendations

Production remains disabled.
