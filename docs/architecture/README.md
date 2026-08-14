# Architecture

- [Constitution](./constitution.md) — canonical owners, boundaries, and dependency direction
- [Manifest](./manifest.json) — machine-readable enforcement input
- [ADR index](./adr/README.md) — decision records (not renumbered)
- [Chunk dependencies](./chunk-dependencies.md) — stop if a protected requirement is not IMPLEMENTED
- [Historical PR guidance](./historical-implementation.md) — older PRs are not automatically canonical
- [PostgreSQL persistence fabric](./persistence.md) — durable adapter behind existing ports
- [Durable event fabric](./events.md) — envelope, outbox, inbox, replay, delivery semantics
- Policy engine — `packages/kernel/src/policy/` (ADR-0006 Option C, simulation only)
- [Compliance screening fabric](./compliance.md) — AML, sanctions, PEP, TM, fraud, cases (ADR-0010)
- [Security and cryptography](./security.md) — KeyProvider, secrets, envelopes, key lifecycle
- Identity lives in `packages/identity` (Chunk 5). ADR-0007 remains PROPOSED.

Implementation inventory: [`docs/build-status.md`](../build-status.md).
