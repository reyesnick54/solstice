# Agent financial execution

Final transaction authority comes from the canonical wallet delegated
key, custody approval, or Execution Authority. AI identity alone cannot
authorize.

`AgentExecutionRequest` binds proposal hash, mandate hash, current
wallet policy, current Compliance Kernel state, current market/account
restrictions, and the transaction content hash.

## Payments

Agent payments use canonical payment / chain / Ledger paths. There is
no second payment ledger.

## Exchange

Bounded exchange orders reuse Chunk 95 eligibility, pre-trade risk,
market state, price protection, and DVP settlement.

## Machine commerce

`MANAGE_ALLOWED_PRODUCTIVE_SERVICE` reuses Chunk 45 machine mandates
and keeps controller/owner attribution.

## Simulation vs production

`SIMULATION_ONLY` mandates can never submit real transactions.
Production requires a real user mandate, active policy, account
authorization, and regulated eligibility.

## Strategy Lab

Simulation and evaluation stay in Strategy Lab / Growth Orchestrator.
Simulation performance is not silently promoted into production
expected returns. Strategies must not represent guaranteed return,
profit, balance growth, or risk-free trading.
