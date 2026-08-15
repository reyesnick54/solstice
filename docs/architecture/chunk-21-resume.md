# Chunk 21 resume (Chunk 21R)

Chunk 21 originally stopped because the protected `risk` and
`model-registry` capabilities were still `PLANNED`. That stop is
historical: [`chunk-21-stop.md`](./chunk-21-stop.md).

Chunk 20 subsequently implemented the Risk Engine at `packages/risk`
and the Model Registry at `packages/model-registry`. This document
records the resumed Agentic Capital Mesh implementation.

## Boundary

The Mesh is a capital-intelligence and proposal system. It is not an
autonomous trading engine. It cannot issue Execution Authority, post
journals, submit broker orders, approve models, change mandates, or
activate live trading.

Personal Economy Agent remains the user-facing explanation layer. The
Mesh reuses that runtime boundary (ActorContext, structured output,
untrusted-content handling) and does not create a second generic AI
runtime.

## Owner

Canonical owner: `packages/agentic-capital-mesh`.

Competing names remain forbidden: `trading-agents`, `investment-agents`,
`hedge-agent`, `capital-ai`, `autonomous-trader`.

## What this resume implements

- Subject-bound `CapitalContext`
- Specialist node registry with scoped read-only tools
- Structured `CapitalThesis` and scenario outcomes (downside / base / upside)
- Deterministic allocation compiler using Investments quantity/price
- Adversarial review and preserved disagreement
- Deterministic `CapitalProposalArbiter` with hard vetoes
- Canonical Risk integration (BLOCK cannot be overridden)
- Strategy validation states that cannot claim `VALIDATED`
- Staleness and a CapitalProposal → StrategyDraft bridge that fails
  until Strategy Lab exists
- PostgreSQL / events / evidence integration

Strategy Lab remains Chunk 22R.
