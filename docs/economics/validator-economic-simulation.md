# Validator economic simulation

`ValidatorEconomicsSimulator` runs engineering scenarios against
fixture units:

- all validators healthy
- one validator intermittently offline
- two validators intermittently offline
- one validator equivocation
- validator exit
- low fee activity
- high fee activity
- unequal voting power
- high bond concentration
- operator concentration

Reports include reconciliation and concentration metrics. They do not
claim guaranteed economic security and do not invent production bond
values.

Launch rehearsal (Chunk 70) exercises seven bonded rehearsal
validators, a healthy reward epoch, one jailed validator, one
evidence-based penalty, unbond delay, and supply reconciliation using
rehearsal-only units.
