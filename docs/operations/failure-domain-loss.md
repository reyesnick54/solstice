# Failure-domain loss

The seven-validator development profile places voting power
`3 + 2 + 2` across three simulated domains.

Removing the three-validator domain leaves `4/7`, which cannot
finalize. Safety must hold. Liveness waits for connectivity.

Removing a two-validator domain leaves `5/7`, which can finalize.

RPC failover is active-active and cannot sign consensus. Explorer
instances are rebuildable and cannot mutate chain.

```
sunrey-ops dr run FAILURE_DOMAIN_LOSS
sunrey-ops topology
```
