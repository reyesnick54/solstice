# ADR-0034 SunRey Access Fabric / Human Access Economy

**Engineering status:** ACCEPTED_FOR_ENGINEERING  
**Legal / regulatory confidence:** RESEARCH_REQUIRED — not a legal opinion  
**Affected subsystem:** ACCESS_ECONOMY  
**Depends on:** personal-economic-graph, agent, sunrey-agent, kernel, permissions, ledger, exchange, custody, sunrey-chain, evidence  
**Implementation status:** PARTIAL (ACCESS-01 foundation only)

## Context

Humans need governed, bounded access to productive capacity — vehicle-hours,
housing, compute, energy, goods, services, and similar capacity — without
conflating access with ownership, money, securities, minting, or human-worth
scoring.

SunRey already has canonical owners for money, compliance, execution, ledger,
custody, exchange, chain consensus, oracles, and the productive economy. A new
bounded context must orchestrate access-domain records without creating
parallel authorities.

## Decision

Implement one Access Fabric bounded context at `packages/access-economy`.

- `AccessRight` models a governed, non-ownership economic right with explicit
  time, quantity, location, or usage bounds.
- `AccessIntent` carries human or agent-proposed access requests. It is not an
  `ActionIntent` and does not issue Execution Authority.
- Access Fabric validates access-domain structure and records proposals. Policy
  approval, settlement, reservation, and delivery evidence remain owned by
  existing canonical systems.
- SunRey Coin remains the human-economic native asset. MoonRey Coin remains the
  productive-economy native asset. No Access Coin, fixed peg, or social-credit
  score is introduced.
- Simulation/production boundaries are preserved. `ENVIRONMENT` stays
  `simulation`. No `LIVE_*` flag is enabled.

## Consequences

- Access Fabric is not a balance source of truth. Ledger, custody, and Exchange
  win for financial state.
- Access Fabric must not import kernel, ledger, permissions, exchange, chain, or
  services directly. Later chunks integrate through orchestration layers.
- No competing `packages/access-*` authority package may be added.
- ACCESS-02 and later chunks may add Kernel gates, Exchange reservation, and
  evidence binding without re-owning monetary or compliance authority.

This ADR is not `CONFIRMED_BY_COUNSEL`.
