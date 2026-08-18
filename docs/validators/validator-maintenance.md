# Validator maintenance

`ValidatorMaintenancePlan` is an operational overlay. It does not
change canonical validator-set membership.

## Safety

Before a plan is accepted the platform projects remaining voting
power. The default operational quorum policy is
`BFT_TWO_THIRDS_PLUS_REMAINING`:

- remaining online power must satisfy two-thirds-plus
- concurrent maintenance power may not exceed 3333 basis points

Unsafe plans are refused. Borderline concurrent plans are warned.

One-node maintenance on a seven-validator equal-power set is allowed.
Three concurrent nodes are refused.

## Mapping

`MAINTENANCE` maps to canonical `ACTIVE`. Signing may be refused by
the node while the overlay is active (Chunk 54 maintenance mode).

```
sunrey-ops validator maintenance
sunrey-ops validator maintenance plan-one
```
