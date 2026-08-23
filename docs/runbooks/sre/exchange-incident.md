# Runbook — Exchange incident

Simulation / preproduction only.

1. Inspect Exchange kill switches (`MARKET`, `ORDER_ENTRY`, `SETTLEMENT`, `WITHDRAWAL`). AI cannot engage them.
2. Banking and payments may remain available while the Exchange is halted.
3. Do not treat in-memory settlement ports as `Ledger.postJournal`.
4. Drain pending settlements only after matching/halt state is understood.
5. Control room recommends this runbook; it does not execute a halt.

Existing: `docs/runbooks/exchange-market-incident.md`, `docs/runbooks/consumer-exchange-incident.md`.
