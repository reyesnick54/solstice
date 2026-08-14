# solstice

Simulation-only digital banking. The Compliance Kernel decides. A signed
Execution Authority executes. The Evidence Vault seals every yes and no.

See `docs/build-status.md` and `AGENTS.md`.

```
npm install
npm test
npm run demo
npm run ci
```

Phase 1 in this tree: customers, Kernel-gated account opening, simulated
deposits / withdrawals / internal transfers, class-segregated balances,
and a verified evidence hash chain.

Real-money rails stay off. `ENVIRONMENT=simulation`. Every `LIVE_*` flag is false.
ADRs 0006 / 0007 / 0008 remain PROPOSED — not ACCEPTED, not CONFIRMED_BY_COUNSEL.
