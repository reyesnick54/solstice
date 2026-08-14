# solstice

Simulation-only digital banking. The Compliance Kernel decides. A signed
Execution Authority executes. The Evidence Vault seals every yes and no.

See `docs/build-status.md`, `docs/architecture/constitution.md`, and `AGENTS.md`.

```
npm install
npm test
npm run demo
npm run ci
```

PostgreSQL is the durable adapter (local/simulated credentials only):

```
npm run db:up
npm run db:migrate
npm run test:persistence
npm run events:outbox
npm run events:dispatch
npm run db:down
```

Event fabric (outbox / inbox / replay): `docs/architecture/events.md`.

Phase 1 in this tree: customers, Kernel-gated account opening, simulated
deposits / withdrawals / internal transfers, class-segregated balances,
a verified evidence hash chain, and PostgreSQL persistence behind those
interfaces. In-memory adapters remain for unit tests.

Real-money rails stay off. `ENVIRONMENT=simulation`. Every `LIVE_*` flag is false.
ADRs 0006 / 0007 remain PROPOSED. ADR-0008 is engineering-accepted for
PostgreSQL — not CONFIRMED_BY_COUNSEL. See `docs/architecture/persistence.md`.
