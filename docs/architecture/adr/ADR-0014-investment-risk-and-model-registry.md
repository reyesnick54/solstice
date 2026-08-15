# ADR-0014 — Investment Risk Engine and Model Registry

- Status: PROPOSED
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-15

## Decision

Investment and portfolio risk lives at `packages/risk`. Model
governance lives at `packages/model-registry`. These are the reserved
RISK and MODEL_REGISTRY bounded contexts.

The Risk Engine produces deterministic paper-portfolio facts and
decisions. Those facts enter the existing Kernel Risk proof. Risk does
not issue Execution Authority, post journals, or replace the Kernel,
policy engine, AML/fraud fabric, Growth Orchestrator, or Investments
service.

Limits in this tree are engineering/simulation controls. They are not
regulatory capital requirements.

## Consequences

- Paper orders must pass pre-trade Risk before Kernel authorization.
- Hard mandate constraints outrank Risk budgets and optimization.
- Stress runs are read-only. They do not mutate ledgers or place orders.
- Model artifacts are hash-addressable. Changing a formula creates a
  new version. Models cannot approve themselves. There is no
  `LIVE_APPROVED` state in this chunk.
