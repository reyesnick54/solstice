# Economic stress scenarios

The catalog lives at `packages/sunrey-economics/src/stress/catalog.ts`.
IDs are stable. There are at least 60 deterministic scenarios.

| Domain | ID prefix | Examples |
| --- | --- | --- |
| Liquidity | `ECON-LIQ-*` | thin book, large order, spread widening, one-sided, maker unavailable, volume surge |
| Productive | `ECON-PROD-*` | issuance pressure, energy collapse, compute abundance/shortage, manufacturing, logistics, AI/robot surge, concentration |
| Oracle | `ECON-ORACLE-*` | outage, staleness, conflict, one-controller, unit mismatch, delay, missing reference |
| Double-count | `ECON-DUP-*` | replay, capacity/output, delivery/output, cross-category, lineage, reorder, epoch boundary |
| Fees | `ECON-FEE-*` | saturation, burst, PQ mix, interop-heavy, oracle-heavy, Exchange-heavy, priority, max-fee |
| Validators | `ECON-VAL-*` | low/high fee, jail, penalty, bond concentration, exit, unbond, reward depletion |
| Human | `ECON-HUM-*` | demand fall/rise, participant growth, information-right collapse, community distribution |
| Automation | `ECON-AUTO-*` | rapid automation shock |
| Machine | `ECON-MACH-*` | spend burst, mandate exhaustion, robot energy, AI compute, concentration, failed delivery, escrow backlog |
| Exchange | `ECON-EXCH-*` | price move, cancel surge, partial fill, settlement congestion, custody delay, submission ambiguity |
| Custody | `ECON-CUST-*` | withdrawal surge, signer unavailable, `SUBMISSION_UNKNOWN`, reconciliation lag, restricted vault |
| Compound | `ECON-COMP-*` | energy+compute+liquidity; oracle+exchange+validator; fee+custody+machine |
| No-quorum | `ECON-NQ-*` | economic freeze without finality |

All values are synthetic. No real person-level data. No external market
is contacted or manipulated.
