# Exchange market families

SunRey Exchange is one venue with four canonical economic families.
Do not add `packages/exchange-v2` or a parallel matching engine.

## DIGITAL_ASSET

Native digital units already recognized by listing governance.
Simulation listings: SunRey Coin and MoonRey Coin (protocol-native
development units). Later assets require a human listing decision.
There is no unreviewed auto-listing.

Continuous book. Price-time priority. Settlement is delivery-versus-
payment: application CoinPort/FiatPort or native atomic DVP.

Market data: best bid/ask, depth, last trade, volume. Last trade is
labeled `SIMULATION_MARKET_PRICE`.

## HUMAN_INFORMATION_RIGHT

Tradable/contractible **rights** around authorized clean-room
computations, aggregate insights, purpose, recipient class, and
duration. This family does not sell raw personal information.

Matching requires consent and purpose at list, match, and delivery.
Revoked consent blocks future use. Raw subject rows remain
unavailable by default.

Market data: contract availability, purpose category, authorized
output type. No subject-level fields.

## INTELLIGENCE_COMPUTE

Instruments for GPU/CPU compute, inference, storage, bandwidth, and
specialized model execution. Units come from the machine-economy
`UnitRegistry` (for example `GPU_SECOND`).

Settlement: escrow the settlement asset, meter delivery through an
oracle fact, pay the verified portion exactly, release unused escrow
when the template says so.

Market data: unit price, available capacity, delivery window.

## PRODUCTIVE_CAPACITY

Contracts around verified capacity or delivery — energy,
manufacturing, storage, logistics, real-estate **use**, agricultural
output. These are rights/contracts. They do not automatically
tokenize title to real property.

Batch auction is the default mode for a future delivery period.
The Global Productive Capacity Graph receives a single reference per
settled contract so the same output is not counted twice.

Market data: delivery period, available quantity, clearing price,
verified delivery statistics.
