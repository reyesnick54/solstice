# Native supply accounting

Every native asset obeys an exact integer conservation identity.
There are no reconciliation plugs and no hidden supply adjustments.

## Classifications

Source classes (do not overlap with live classes):

- `GENESIS_ALLOCATED`
- `ISSUED_POST_GENESIS`

Sink:

- `BURNED`

Live partition (exact, no double counting):

- `CIRCULATING`
- `LOCKED`
- `ESCROWED`
- `FEE_RESERVED`

## Identity

```
genesisAllocated + issuedPostGenesis - burned
  = circulating + locked + escrowed + feeReserved
```

Locked quantity remains part of supply. Lock classes include
`ORDER_RESERVATION`, `MACHINE_ESCROW`, `INTEROP_ESCROW`,
`VALIDATOR_BOND`, and `OTHER_GOVERNED_LOCK`. Escrow classes occupy
`ESCROWED`, not `LOCKED`.

A blockchain treasury account, when represented, is classified
`SUNREY_BLOCKCHAIN_TREASURY` and is distinct from the fiat
`packages/treasury` owner.
