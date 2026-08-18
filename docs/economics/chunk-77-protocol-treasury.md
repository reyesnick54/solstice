# Chunk 77 — SunRey protocol treasury and reserves

Canonical owner: `packages/sunrey-chain/src/economics/treasury`.

This is the blockchain-native treasury for protocol-owned `SUNREY_COIN` and
`MOONREY_COIN`. It is not `packages/treasury` (fiat/application treasury), not
a second financial Ledger, and not a new native asset.

## Ownership boundary

| Surface | Owner |
| --- | --- |
| Protocol-owned native reserves | `packages/sunrey-chain/src/economics/treasury` |
| Fiat / application treasury | `packages/treasury` |
| Customer wallets, custody, Exchange obligations, machine escrow, fiat Ledger balances | unreachable |

## What treasury can do

- Receive existing native quantity from permitted funding sources
- Hold that quantity in governed reserve classes
- Authorize budgets and reserve quantity
- Finalize disbursements only through chain state transition

## What treasury cannot do

- Mint SunRey or MoonRey because a budget needs funding
- Represent fiat by labeling a native quantity as dollars, riyals, or euros
- Claim customer assets
- Create a price peg, guaranteed value, guaranteed liquidity, or redemption
- Let AI vote, approve, authorize, or activate reserve policy

Production treasury remains inactive. Production spending limits remain
`UNCONFIGURED`.
