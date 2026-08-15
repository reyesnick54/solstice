# ADR-0013 Personal Economic Value Engine

**Engineering status:** PROPOSED  
**Legal / regulatory confidence:** not a legal opinion; no counsel review  
**Affected subsystem:** PERSONAL_ECONOMIC_VALUE_ENGINE  
**Depends on:** money, identity, events, evidence, persistence, personal-economic-graph, personal-economy-agent, growth-orchestrator  
**Implementation status:** IMPLEMENTED (simulation measurement layer on this tree)

## Context

After PEG, the Personal Economy Agent, and the Growth Orchestrator exist,
the system still needs an explainable measurement of a person's economic
system: capacity, resilience, attributed benefit, and progress. That
measurement must not become a human-worth score, social-credit score,
or credit underwriting system.

## Decision

- Own PEVE in `packages/platform/src/value`, sharing the reserved
  platform path with the Growth Orchestrator.
- Begin with a multi-dimensional EconomicValueVector, not one opaque
  number. A composite index is convenience-only, versioned, and
  decomposable.
- Distinguish INDEX values from MONEY values. Never present an index
  as a dollar figure.
- Record economic-benefit attribution in a PEVE GrowthAttributionLedger
  that cannot move principal or post financial journals. The banking
  `packages/ledger` GrowthAttributionLedger remains the principal-movement
  guard.
- Separate REALIZED / OBSERVED totals from PROJECTED / ESTIMATED /
  COUNTERFACTUAL totals.
- Prevent double counting with attribution groups.
- Keep formula versions immutable once used.
- Agent and Growth access is read-only. A high PEVE index never
  authorizes execution.

## Consequences

- Do not create `packages/value-engine`, `packages/peve`,
  `packages/economic-score`, or `packages/personal-value`.
- Do not start the Regulatory Digital Twin in this chunk.
- This ADR is not `CONFIRMED_BY_COUNSEL`.
