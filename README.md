# solstice

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

