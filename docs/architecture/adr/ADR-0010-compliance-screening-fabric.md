# ADR-0010: Canonical compliance screening and monitoring fabric

- **Status:** PROPOSED
- **Date:** 2026-08-14
- **Deciders:** Engineering. A human must accept or reject this record.
- **Consulted:** None on file. No counsel review.
- **Informed:** Kernel, policy, identity, accounts, persistence.
- **Legal / regulatory confidence:** RESEARCH_REQUIRED — no counsel review; simulation adapters only.

---

## Context

Solstice already has a six-proof Compliance Kernel, a deterministic jurisdiction
policy engine, Identity facts, an Evidence Vault, and durable events. It did not
have a single provider-neutral screening and monitoring control plane.

Competing `aml` / `fraud` / `sanctions` packages would split authority.

## Decision

Own the screening/monitoring fabric inside the reserved COMPLIANCE context:

- Canonical model: `packages/kernel/src/compliance`
- Application facade: `services/compliance`
- Persistence: `packages/persistence` + `db/customer` V004
- Events: existing `packages/events` envelope

Policy packs declare which screenings are required and how outages fail closed.
The fabric produces facts. The existing Compliance and Risk proofs escalate
monotonically. Screening results never issue Execution Authority.

## Consequences

- Simulation providers only. No OFAC/UN/EU/HMT claim.
- Transaction-monitoring thresholds are engineering test rules labeled
  `RESEARCH_REQUIRED`.
- A confirmed sanctions BLOCK cannot be generically overridden.
- An AI actor cannot finalize a regulated case.
