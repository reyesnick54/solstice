# Runbook — Reconciliation break

Simulation / preproduction only.

1. Count breaks. Do not auto-journal to force a match.
2. Classify: payments, custody, exchange, supply, or outbox/inbox.
3. If the spike is supply or ledger imbalance, escalate as financial integrity.
4. Recovery is reconciliation complete, not a green provider check.
5. Explorer and other projections rebuild; they are not books.

Existing: `docs/runbooks/custody-reconciliation.md`, `docs/runbooks/exchange-settlement-reconciliation.md`.
