# Treasury reconciliation

At all times the engine verifies:

```
opening balance
+ authorized funding
+ returned funds
- finalized disbursements
=
available
+ reserved
+ other explicitly defined encumbered quantity
```

There are no balancing entries.

`sunrey-economics treasury verify` reconciles funding, reservations,
disbursements, returns, balances, and policy versions.

Engineering solvency metrics report available reserve, reserved reserve,
budget obligations, inflow, outflow, a stated coverage ratio, and reserve
concentration. They do not claim bank solvency or deposit insurance.
