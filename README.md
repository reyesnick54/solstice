# solstice

Simulated digital banking: Compliance Kernel + Global Money Fabric.

Nothing that changes financial state executes outside the Kernel.
Payments are simulated end to end (domestic and cross-border). There
are no live rails.

```
npm install
npm run ci
npm run demo
```

See `AGENTS.md` and `docs/build-status.md`.
See [docs/BUILD-STATUS.md](docs/BUILD-STATUS.md) for what is implemented and tested.

Phase 1 — Banking Simulation is **not** complete.

## Run what exists

```bash
cd packages/domain && npm test
cd packages/domain && npm run demo
```
New fintech, digital banking solution.

Phase 4–5: the Personal Economy Agent can **propose**, be **refused**, and
**explain**. It cannot execute. Capability tokens are enforced in
infrastructure. The weekly economic delta is sourced and honest about
realization class. There is no percentage-return path.

See `AGENTS.md` for the isolation contract.

```
npm test
npm run demo
```
Phase 1 is a banking simulation. Real money stays off.

## CI

From the repository root:

```bash
bash scripts/ci.sh
```

Stages run in this order and none may be skipped: architectural invariants, deployment posture, tests, end-to-end demo, secret scan.

