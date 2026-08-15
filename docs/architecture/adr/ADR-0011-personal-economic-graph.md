# ADR-0011 Personal Economic Graph

**Engineering status:** PROPOSED  
**Legal / regulatory confidence:** not a legal opinion; no counsel review  
**Affected subsystem:** PERSONAL_ECONOMIC_GRAPH  
**Depends on:** identity, events, persistence, money  
**Implementation status:** PARTIAL (simulation graph/read layer on this tree)

## Context

Solstice needs a structured economic memory for one person so later
intelligence (Personal Economy Agent, Growth Orchestrator) can reason
over relationships without treating a chat log or a ledger copy as the
model.

## Decision

Implement one Personal Economic Graph bounded context at
`packages/personal-economic-graph`.

- Nodes and edges are strongly typed.
- Material facts carry provenance and confidence.
- Temporal versions are superseded, not overwritten.
- Canonical Solstice events populate a non-authoritative projection.
- User-declared facts survive rebuild and cannot masquerade as verified.
- Opportunities are proposal-only and cannot execute.
- Access uses Identity `ActorContext`.

## Consequences

- PEG is not a balance source of truth. The ledger wins.
- PEG must not post journals or issue Execution Authority.
- No competing financial-graph / user-graph package may be added.
- The Personal Economy Agent remains unimplemented.

This ADR is not `CONFIRMED_BY_COUNSEL`.
