# MoonRey issuance budgets

`IssuanceBudgetPolicy` bounds issuance without inventing production
quantities.

## Boundaries

- per contribution
- per productive object
- per actor
- per category
- per epoch
- global epoch

## UNCONFIGURED

Production caps are `UNCONFIGURED` until a governed production decision
exists. Development fixtures may carry numeric
`ENGINEERING_SIMULATION_PARAMETERS`. Those numbers are not production
caps and not economic promises.

## Epochs

Epochs are derived from protocol height:

`epoch = floor(height / epochLengthHeights)`

Consensus does not use wall-clock time to choose an epoch.
