# ADR-0013 — Regulatory Digital Twin

- Status: PROPOSED
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-15

## Decision

The Regulatory Digital Twin is a simulation / counterfactual layer at
`packages/regulatory-twin`. It evaluates frozen or synthetic facts
against the existing deterministic policy engine. It is not a second
Compliance Kernel, policy engine, or jurisdiction-pack store.

## Consequences

- Current-vs-candidate evaluation reuses `PolicyEngine.evaluateFacts`.
- Execution Authority is never issued. Ledger journals are never posted.
- Candidate packs cannot be activated on the production registry.
- Legal-review status cannot become `CONFIRMED_BY_COUNSEL` in this tree.
- Readiness output is never `LEGALLY_APPROVED`.
