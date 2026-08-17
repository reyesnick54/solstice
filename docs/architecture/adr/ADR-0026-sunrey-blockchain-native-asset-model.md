# ADR-0026 — SunRey Blockchain native asset model

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN / SUNREY_COIN
- Depends on: ADR-0019, ADR-0020, ADR-0031
- Implementation status: IMPLEMENTED for development chain-native
  units at `packages/sunrey-chain` (Chunk 41). Chunk 71 adds the
  dual-asset monetary constitution at
  `packages/sunrey-chain/src/economics` without deciding production
  quantities. Application SunRey Coin on the canonical Ledger remains
  IMPLEMENTED and is not migrated. Public tickers remain
  `NOT_ASSIGNED`.

## Context

SunRey Coin exists today as `AssetQuantity` journals on the canonical
Ledger (`packages/sunrey-coin`). Public ticker: `NOT_ASSIGNED`.
MoonRey Coin is a named future native asset. It is **not**
implemented. Its ticker is **not** assigned. The two assets must
remain distinct.

The chain must be able to represent native assets eventually without
becoming a second fiat ledger and without inventing tickers.

## Decision

1. **Native assets** are typed protocol objects with integer minor
   units (`bigint` / integer), an asset id that is **not** a ticker,
   and a ticker status that may only be `NOT_ASSIGNED` until a later
   human decision.
2. **SunRey Coin (today):** authoritative state is the canonical
   Ledger. The chain may store settlement anchors and commitments.
   Moving authority to the chain requires a later explicit ADR and
   Kernel-gated migration. Silent dual-authority is forbidden.
3. **MoonRey Coin:** distinct asset. Not a share of SunRey Coin, not
   a ticker alias, not implemented, ticker `NOT_ASSIGNED`. Do not
   create `packages/moonrey-coin` in this chunk. Do not invent
   `MOON`, `MRN`, `MRC`, `MREY`, or similar.
4. **Fiat, deposits, payments, brokerage cash, securities** are not
   native chain assets (ADR-0031).
5. Mint, burn, and transfer of *chain-native* units, when
   implemented, are native-module handlers. They cannot be performed
   by WASM user programs or AI agents. They do not post fiat
   journals.
6. No yield, APY, APR, blended return, or market-cap field exists on
   the asset object.
7. No live asset is activated.

### Invented-ticker denylist (non-exhaustive)

`SUNREY`, `SRN`, `SRY`, `REYN`, `RYN`, `RCOIN`, `MOON`, `MRN`, `MRC`,
`MREY`, `PYR`. Historical aliases are not public tickers.

## Alternatives considered

- **ERC-20-style user tokens as the native model.**
- **Move SunRey Coin onto the chain in this chunk.**
- **Treat MoonRey as a SunRey Coin denomination.**
- **Assign temporary tickers for documentation.**

## Why rejected

- ERC-20 makes every contract a minter and inherits EVM assumptions.
- Migrating Coin now would create dual ledgers and pretend the chain
  is a production asset host.
- Collapsing MoonRey into SunRey Coin violates the distinct-asset
  requirement.
- Inventing tickers is explicitly forbidden.

## Security implications

Double-spend of native units is a chain safety problem. Double-entry
fiat remains a ledger problem. Bridging the two without an authority
matrix row is a theft primitive.

## Compliance implications

Neither coin is classified as a security, commodity, deposit, or
e-money. Status remains `RESEARCH_REQUIRED` /
`UNCLASSIFIED_SIMULATION` for SunRey Coin. MoonRey has no legal
classification because it does not exist. Not
`CONFIRMED_BY_COUNSEL`.

## Operability implications

Supply reconciliation stays "record mismatch, never auto-mint" for
Ledger-based Coin. A future chain supply module must keep the same
invariant.

## Migration implications

Any later native-unit genesis must start at zero or at an
explicitly evidenced snapshot. Simulation balances are not a
mainnet premine.

## Unresolved questions

- Economic role of MoonRey versus SunRey Coin (product, not
  protocol freeze).
- Whether MoonRey later gets its own package or a native-asset
  module only.

## Status

`ACCEPTED_FOR_ENGINEERING` for distinct assets, integer units, and
Ledger-first application SunRey Coin authority. Development
chain-native units: **implemented** (Chunk 41) under
`NATIVE_BLOCKCHAIN_AUTHORITY` without importing application supply.
Tickers: **not assigned**. Legal confidence: `RESEARCH_REQUIRED`.
