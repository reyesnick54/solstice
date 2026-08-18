# Production launch plan

`ProductionLaunchPlan` is the exact bound input to authorized genesis
execution.

It is not a capability-activation plan. Changing any bound hash
produces a new `planHash`. `ProductionLaunchAuthorization` must bind
that hash.

Rehearsal plans use `net_sunrey_genesis_execution_rehearsal_1` and are
unusable as production inputs.

See [chunk-88-genesis-execution.md](./chunk-88-genesis-execution.md).
