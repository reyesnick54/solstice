# Architecture

- [Constitution](./constitution.md) — canonical owners, boundaries, and dependency direction
- [Manifest](./manifest.json) — machine-readable enforcement input
- [ADR index](./adr/README.md) — decision records (not renumbered)
- [Chunk dependencies](./chunk-dependencies.md) — stop if a protected requirement is not IMPLEMENTED
- [Chunk 12 stop (historical)](./chunk-12-stop.md) — original stop while Cards was PLANNED
- [Chunk 12 resume](./chunk-12-resume.md) — wallet / Tap-to-Pay implemented after Cards merged
- [Chunk 13 stop (historical)](./chunk-13-stop.md) — original process-gate stop before treasury existed
- [Chunk 13 resume](./chunk-13-resume.md) — treasury / liquidity / routing intelligence implemented
- [Chunk 15 stop (historical)](./chunk-15-stop.md) — original stop while Treasury was still PLANNED; agent remains unstarted
- [Historical PR guidance](./historical-implementation.md) — older PRs are not automatically canonical
- [PostgreSQL persistence fabric](./persistence.md) — durable adapter behind existing ports
- [Durable event fabric](./events.md) — envelope, outbox, inbox, replay, delivery semantics
- Policy engine — `packages/kernel/src/policy/` (ADR-0006 Option C, simulation only)
- [Compliance screening fabric](./compliance.md) — AML, sanctions, PEP, TM, fraud, cases (ADR-0010)
- [Security and cryptography](./security.md) — KeyProvider, secrets, envelopes, key lifecycle
- Identity lives in `packages/identity` (Chunk 5). ADR-0007 remains PROPOSED.
- [Personal Economic Graph](./economic-graph.md) — first SFF 2.0 intelligence layer. Does not execute.

Implementation inventory: [`docs/build-status.md`](../build-status.md).
