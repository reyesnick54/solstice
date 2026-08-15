# ADR-0012 Machine-verifiable economic mandates and Growth Orchestrator

**Engineering status:** PROPOSED  
**Legal / regulatory confidence:** not a legal opinion; no counsel review  
**Affected subsystem:** GROWTH_ORCHESTRATOR / PERSONAL_ECONOMY_AGENT  
**Depends on:** identity, personal-economic-graph, events, evidence, persistence, permissions  
**Implementation status:** PARTIAL (simulation planning layer on this tree)

## Context

A person needs a typed, versioned economic mandate so later planning can
respect hard limits. A Growth Orchestrator then turns PEG facts, the
active mandate, and agent ideas into an explainable plan. Neither layer
may execute money movement.

## Decision

- Own mandates and the Growth Orchestrator in `packages/platform`.
- Own the Personal Economy Agent in `packages/agent`.
- The agent may interpret language and explain. It cannot execute, post
  journals, issue Execution Authority, or depend on `packages/platform`.
- Only an ACTIVE, user-confirmed, deterministically compiled mandate
  governs plan generation.
- Hard constraints cannot be overridden by model output or soft
  preferences.
- Feasibility, ranking, and money arithmetic are deterministic and use
  canonical Money.
- Investment execution remains unimplemented. Investment candidates stay
  `PROPOSAL_ONLY` / `DEPENDENCY_NOT_IMPLEMENTED`.
- An approved supported action may materialize a canonical ActionIntent.
  This chunk does not auto-submit that intent.

## Consequences

- Do not recreate Compounder, Growth OS, wealth-agent, or mandates-v2.
- Personal Economic Value Engine is implemented on the shared
  `packages/platform` path (`packages/platform/src/value`). See ADR-0013.
- This ADR is not `CONFIRMED_BY_COUNSEL`.
