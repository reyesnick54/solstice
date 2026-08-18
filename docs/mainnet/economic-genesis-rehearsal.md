# Economic genesis rehearsal

The economic-rehearsal genesis is a distinct simulation artifact.

## Binding

The genesis hash binds:

- protocol version `1`
- economic RC `SUNREY_ECONOMIC_RC_1`
- seven rehearsal validators with rehearsal-only keys
- CryptoPolicy
- monetary constitution
- FeePolicyV2 and disposition
- validator bond / reward / penalty policies
- MoonRey issuance policy
- treasury policy
- governance policy (validator supermajority; AI may not govern)

## Allocations

Every unit appears in the rehearsal genesis manifest and is labeled
`REHEARSAL_ONLY` / `NO_PRODUCTION_VALUE`.

SunRey Coin rehearsal totals `11_000_000` minor units across network
security (validator bonds), treasury, ecosystem/exchange liquidity,
synthetic user distribution, and reserve. MoonRey Coin genesis supply
is zero; issuance is post-genesis from verified productive contributions.

This allocation does not copy production-candidate assumptions. The
Chunk 65 production-candidate allocation remains the empty/zero
unapproved manifest.

## Addressing

Rehearsal addresses use HRP `srecr`. They must not be presented as
production addresses (`srprd`) or as Chunk 70 launch-rehearsal addresses
(`srtst`).
