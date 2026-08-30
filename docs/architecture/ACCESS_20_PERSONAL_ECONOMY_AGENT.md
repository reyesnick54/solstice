# ACCESS-20 — Unified Personal Economy Agent

Classification: engineering simulation on current `main`. Extends the Personal Economy Agent, Growth Orchestrator, PEG, and Access Fabric without creating a second investment engine, ledger, Kernel, or Execution Authority.

## Mission

Upgrade the Financial / Personal Economy Agent into a unified Personal Economic Operating System that understands:

- fiat liquidity and bank balances
- investments and Grow My Money strategies
- SunRey and MoonRey holdings
- Access allocations, expirations, and planned demand
- human and productive contribution opportunities

AI remains **proposal-only** for consequential actions.

## Canonical owners

| Concern | Owner |
|---------|-------|
| Unified snapshot, objective, scenarios, recommendations | `packages/platform/src/personal-economy` |
| Personal Economy Agent (isolated proposals) | `packages/agent` |
| Growth Orchestrator | `packages/platform` |
| Financial Agent mandates + ProposalGate | `packages/sunrey-agent` |
| PEG read model | `packages/personal-economic-graph` |
| Access projection | `packages/human-access-economy` |
| Consumer BFF | `services/api/src/consumer/personal-economy.ts` |

## PersonalEconomySnapshot

Read model projection (`packages/platform/src/personal-economy/snapshot.ts`):

- cash, liquidity, investments, liabilities
- income / cash-flow summary
- SunRey and MoonRey holdings
- Access entitlement summary, upcoming expirations, planned demand
- human and productive contribution opportunities

Flags: `authoritativeBalance: false`, `ledgerWins: true`, `guaranteedOutcome: false`.

## Personal economic objective

Versioned planning objective (`objective.ts`):

**Maximize:** expected financial utility + access sufficiency + liquidity resilience

**Minus:** investment risk, token concentration, liquidity shortfall, access shortage, unwanted lockup, policy violations

Does **not** encode human worth or optimize solely for maximum token holdings.

## Planning constraints

User-defined constraints (`constraints.ts`):

- minimum emergency cash
- maximum investment risk
- maximum SR / MR exposure
- desired travel, mobility, food/energy Access
- time horizon and liquidity needs

Recommendations must respect hard constraints.

## Scenario planner

Deterministic simulations (`scenario.ts`) for questions such as:

- "What if I invest $5,000?"
- "What if I buy 100 SR / MR?"
- "What if I keep my tokens for six months?"
- "What if I want two major trips next year?"
- "What if I contribute spare GPU capacity?"
- "What if token prices fall 50%?"
- "What if markets fall 20%?"

Outputs are simulations, not guarantees.

## Recommendation types

| Type | Meaning |
|------|---------|
| `FIAT_INVESTMENT` | Measured fiat allocation toward goal-aligned investments |
| `LIQUIDITY_ADJUSTMENT` | Emergency reserve or liquidity rebalance |
| `SR_ACQUISITION` / `MR_ACQUISITION` | Token participation tied to utility and constraints |
| `SR_REDUCTION` / `MR_REDUCTION` | De-risk or rebalance native holdings |
| `ACCESS_RESERVATION` | Plan or top up Access for stated experiences |
| `DATA_OPPORTUNITY_PARTICIPATION` | Human information opportunity (proposal only) |
| `PRODUCTIVE_CAPACITY_CONTRIBUTION` | Productive capacity contribution (proposal only) |
| `NO_ACTION` | Continue monitoring |

All recommendations: `executable: false`, `requiresApproval: true`.

## Invariants

- `AGENT_CANNOT_SELF_APPROVE`
- `AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY`
- `AGENT_CANNOT_MINT_SR` / `AGENT_CANNOT_MINT_MR`
- `AGENT_CANNOT_INVENT_ACCESS`
- `AGENT_CANNOT_PROMISE_RETURNS`
- `AGENT_CANNOT_OPTIMIZE_FOR_HUMAN_WORTH`
- `AGENT_CANNOT_OVERRIDE_USER_RISK_CONSTRAINTS`
- `NO_DEPOSIT_COUNTED_AS_INVESTMENT_PERFORMANCE`

## Consumer BFF

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/personal-economy/overview` | Unified snapshot projection |
| GET | `/api/v1/personal-economy/plan` | Simulation plan + objective |
| POST | `/api/v1/personal-economy/scenarios` | What-if simulation |
| POST | `/api/v1/personal-economy/proposals` | Proposal-only recommendations |

Sandbox persona: `personal_economy` (`Bearer sandbox.personal_economy`).

## E2E demo

```bash
npm run demo:personal-economy
```

Fixture posture:

- Cash: $25,000
- Investments: $100,000
- SR: 100, MR: 100
- Emergency reserve target: $15,000
- Two vacations next year, moderate risk

The demo prints a simulation plan. No auto-execution.

## Tests

- `packages/platform/src/personal-economy/personal-economy.test.ts`
- `services/api/src/consumer-personal-economy.test.ts`

## Integration seam

```
PEG + Growth Orchestrator + optional Access / wallet ports
  → PersonalEconomyService.buildSnapshot / buildPlan / simulateScenario
  → PersonalEconomyBffSurface
  → Consumer BFF /api/v1/personal-economy/*
```

Execution remains downstream: customer approval, valid mandate, ProposalGate, Compliance Kernel, Execution Authority.
