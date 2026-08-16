# Productive capacity market

Capacity markets contract verified productive capacity. They reuse
the Global Productive Capacity Graph and the oracle network. They
do not issue MoonRey and do not tokenize title to real property.

## Contract

`ProductiveCapacityContract`:

- productive object
- capacity category (energy, manufacturing, storage, logistics,
  real-estate use, agricultural output)
- quantity and unit
- delivery window and location
- rights reference
- provider and buyer
- oracle policy
- delivery conditions
- settlement terms
- failure terms
- `tokenizesTitle: false`

## Auction mode

Continuous books are often inappropriate for a future delivery
period. The default mode is a deterministic batch auction:

- `openHeight` / `closeHeight`
- bids sorted price descending, then sequence
- offers sorted price ascending, then sequence
- pairs cross when bid ≥ ask
- uniform clearing price is the last accepted ask
- ties break by earlier sequence, then order id

See `packages/sunrey-exchange/src/auction.ts`.

## Settlement

Template `MANUFACTURING_CAPACITY_V1` (and energy/storage variants):

escrow + oracle output fact + exact partial pay → graph reference

The productive graph records one `(objectId, contractId)` pair.
A second settlement of the same pair is `DOUBLE_COUNT_FORBIDDEN`.

## Market data

Delivery period, available quantity, clearing price, verified
delivery statistics.
