# Solstice build status

This file describes what is in `main` and what has been tested.
It does not describe planned work as if it were done.

**As of 2026-08-13 (commit `de3c633` on `main`): Phase 1 — Banking Simulation is not complete. The Phase 1 exit criterion is not met.**

---

## How to run what exists

There is one end-to-end demo. It lives at `packages/domain/src/demo.ts`.
It is invoked from that package:

```bash
cd packages/domain && npm test
cd packages/domain && npm run demo
```

There is no root `package.json` test script on `main`. Output from the demo
goes to **standard output** (the terminal). The demo does not write files.

The demo prints one JSON object per step, then the line `demo: ok`.
It shows a customer being opened as a prospect, legal status changes, and
one illegal change (`CLOSED` → `ACTIVE`) being rejected as a typed error.
It does not open an account, post deposits, show a balance, or verify an
evidence hash chain.

---

## What is implemented and tested on `main`

| Item | Status |
| --- | --- |
| Customer domain (`packages/domain`) | Implemented. 30 tests pass. |
| Customer demo (`packages/domain/src/demo.ts`) | Implemented. Runs to `demo: ok`. |
| ADR-0006 policy engine language | Proposed document only. No engine, no packs. |
| ADR-0008 persistence layer | Proposed document only. No database, no repositories. |
| Compliance Kernel | Not in `main`. |
| Execution Authority (signed, short-lived) | Not in `main`. |
| Account opening through the Kernel | Not in `main`. |
| Evidence Vault and hash-chain verifier | Not in `main`. |
| Ledger / simulated deposits | Not in `main`. |
| Class-segregated balance read model | Not in `main`. |
| Capability / live-money flags | Not in `main`. |
| Phase 1 exit-criterion test | Not in `main`. |

Test count on `main`: **30 passed, 0 failed** (`packages/domain`).

---

## Phase 1 exit criterion

The exit criterion is true only when all of the following can be shown in
one place, against running code, with no assertion relaxed:

1. A person can open an account, and that opening happens only with a valid Execution Authority from the Compliance Kernel.
2. A balance can be read and is segregated by class (insured deposits are not mixed with other classes).
3. Every state change in that flow produced an evidence record.
4. The evidence hash chain verifies end to end.
5. Deposit journals balance (debits equal credits).
6. A refused account opening produced evidence and created no account.

**None of those six points hold on `main`.** There is no Kernel, no
Execution Authority, no account service, no ledger, no deposits, and no
Evidence Vault in this tree.

Work on those pieces exists on unmerged branches. Those branches are not
one product: they use different layouts (`packages/` vs repository-root
`src/`), different demos, and different account-class names. They are not
treated as delivered.

A separate open pull request named a “Phase 1 exit-criterion” test that
returns success when account, balance, or evidence files are missing.
That is not this criterion. This repository does not accept a pass that
skips a missing path.

---

## What this means

A person cannot open an account in this repository and see a class-segregated
balance with every state change evidenced. Phase 1 is therefore not done.
Closing issues or merging unrelated documents does not change that.
