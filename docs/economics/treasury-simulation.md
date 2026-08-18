# Treasury simulation

`TreasuryScenarioSimulator` is an engineering simulation. Required
scenarios:

- normal protocol operations
- low fee income
- high fee income
- large infrastructure budget
- validator reward demand
- emergency security expense
- multiple competing budgets
- reserve concentration
- low available reserve

Chunk 76 economic stress and Chunk 77 protocol treasury are both
present. Chunk 77 provides the treasury stress catalog: budget
exhaustion, duplicate disbursement, unauthorized recipient, wrong
asset, reservation race, fee revenue collapse, and large emergency
expense. Chunk 78 economic RC qualification consumes those
implementations rather than a placeholder.

Long-horizon modeling reuses Chunk 75 abstract epochs. Treasury ownership
of MoonRey is not a productive contribution and cannot generate additional
MoonRey.
