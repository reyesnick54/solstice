# SunRey Coin

Canonical owner: `packages/sunrey-coin`.

SunRey Coin is a **simulation** economic ledger for authorized
Clean Room contributions. Journals stay on the canonical Ledger.
This is not a second ledger, not an exchange, and not a chain.

## Brand and ticker

- Brand: **SunRey**
- Asset: **SunRey Coin**
- Asset id: `asset:sunrey-coin` (not a ticker)
- Ticker status: `NOT_ASSIGNED`
- Future: **SunRey Exchange** and **SunRey Chain** remain `PLANNED`

Do not invent `SUNREY`, `SRN`, `SRY`, `REYN`, `RYN`, or `RCOIN`.

## Authorization

Issue, transfer, and burn submit an `ActionIntent` to the Compliance
Kernel. HOLD / BLOCK / DEFER / REQUIRE_MANUAL_REVIEW post nothing.
On ALLOW the Kernel issues a signed Execution Authority. Callers
verify that authority before `Ledger.postJournal`.

The Personal Economy Agent cannot mint, burn, transfer, or issue
Execution Authority. That is a structural boundary, not a prompt.

## Quantity

`AssetQuantity` is bigint scaled units plus an asset id. It is not
`Money`. Fiat Money and AssetQuantity must not share a journal.

## Contribution formula

Versioned formula v1 multiplies eight 0–100 bigint factors by a base
reward and divides by `100^8` with **FLOOR**. Factors come from Clean
Room contribution metadata. Protected identity traits must not change
the weight.

## Positions and supply

Custody positions are derived from journals. There is no stored
balance. Reconciliation requires `issued - burned === holdings`.
Mismatch is recorded. The system never auto-mints or auto-burns to
force a match.

Market price is `UNAVAILABLE`. There is no yield, APY, APR, or
blended return.

## Legal status

`RESEARCH_REQUIRED` / `UNCLASSIFIED_SIMULATION`. Not classified as a
security, commodity, deposit, e-money, stablecoin, or utility token.
Nothing here is `CONFIRMED_BY_COUNSEL`.
