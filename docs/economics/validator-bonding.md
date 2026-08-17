# Validator bonding

Validators post a governed bond before they become economically
accountable. The bond is a native-lock position, not a customer
deposit and not public delegated stake.

## Asset

- Development fixture: `DEVELOPMENT_SUNREY_COIN`
- Rehearsal fixture: `REHEARSAL_SUNREY_COIN`
- Production: `UNCONFIGURED`

Minimum bond is governed. Production minimum remains unconfigured.
Development and rehearsal minima are fixtures.

## Exclusive lock

A bonded unit cannot also be spent, withdrawn, Exchange reserved,
machine escrowed, interop escrowed, or bonded to another validator.

## States

`UNBONDED`, `BONDING`, `BONDED`, `UNBONDING`, `JAILED`, `TOMBSTONED`,
`EXITED` integrate with the existing validator lifecycle.

## Eligibility versus voting power

Meeting the minimum bond is an eligibility condition. It does not
automatically assign voting power. Coin-equals-vote is refused unless
a later governed architecture chooses it.

## Unbonding and exit

Unbonding is delayed. Pending evidence and the accountability window
block release. Exit reconciles rewards, pending evidence, bond, and
validator status. Tombstoned identities cannot silently regain
authority.
