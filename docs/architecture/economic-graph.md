# Personal Economic Graph

The Personal Economic Graph (PEG) is the first SFF 2.0 intelligence
layer. It is the structured economic representation of one person's
financial life.

PEG is **not**:

- a ledger replacement
- a banking balance source of truth
- an AI chat history
- a raw data lake
- an autonomous execution engine

It is a graph / read-intelligence projection built from canonical
Solstice events and explicitly sourced user-declared facts.

## Placement

```text
Canonical Financial Systems
        ↓
Personal Economic Graph
        ↓
Personal Economy Agent
        ↓
Growth Orchestrator
        ↓
Agentic Capital Mesh
        ↓
Execution Control Plane
```

PEG does not execute. Future agents receive scoped graph access through
Identity `ActorContext`, not database credentials.

## Canonical owner

`packages/personal-economic-graph` with facade `services/economic-graph`.

Do not create `financial-graph`, `user-graph`, `economic-memory`, or
`personal-finance-graph`.

## Identifiers

Graph IDs are branded and prefixed (`peg_g_`, `peg_n_`, `peg_e_`,
`peg_f_`, `peg_src_`, `peg_s_`). They are not ledger IDs. Canonical
accounts, payments, and cards are referenced, not copied.

## Provenance and confidence

Every material fact records source type, source reference, observedAt,
effectiveAt, confidence, and version.

Confidence is one of `AUTHORITATIVE`, `VERIFIED`, `USER_DECLARED`,
`DERIVED`, `INFERRED`.

Rules:

- User-declared facts cannot masquerade as verified or authoritative.
- Derived and inferred facts cannot be labeled authoritative.
- PEG must not store an AUTHORITATIVE balance. The ledger wins.

## Temporal history

Facts carry `validFrom`, `validTo`, `observedAt`, `supersededBy`, and
`version`. History is superseded, not overwritten.

## Rebuild

Derived projection can be destroyed and rebuilt by replaying source
events. User-declared facts survive rebuild.

## Access

Reads require a verified `ActorContext` with `VIEW_ECONOMIC_GRAPH`.
Declarations require `DECLARE_ECONOMIC_FACT`. Cross-subject access
requires an explicit `OPERATE_ECONOMIC_GRAPH` grant.

## Persistence

PostgreSQL schema `economic_graph` in `solstice_customer`. Relational
graph modeling. No Neo4j.
