# Genesis candidate

`sunrey-genesis candidate` builds a deterministic production
**candidate**. It does not publish genesis.

## Candidate identity

| Field | Value |
| --- | --- |
| Display name | SunRey Production Candidate 1 |
| Network ID | `net_sunrey_production_candidate_1` |
| Chain ID | `chn_sunrey_production_candidate_1` |
| Address HRP | `srprd` (Chunk 46 reserved production) |
| Protocol version | `1` |
| Genesis version | `candidate-1` |
| Status | `CANDIDATE` |
| `mainnetEnabled` | `false` |
| Environment | `simulation` |

These IDs remain candidates until human authorization. They do not reuse
testnet, local-dev, or simulation IDs.

Chunk 85 binds an exact later Production Network Candidate V2 and
Mainnet RC into the production genesis ceremony plan. Changing those
artifacts requires a new ceremony plan version. Candidate 1 remains
the Chunk 65 predecessor and is not automatically Candidate V2.

## Canonical encoding

Domain `SUNREY_PRODUCTION_GENESIS_CANDIDATE_V1`. Identical approved
inputs produce an identical SHA-256 candidate hash. JSON presentation is
not consensus serialization.

## Verification

`sunrey-genesis candidate verify` / `sunrey-mainnet verify` checks
network identity, chain identity, genesis hash, validator-set hash,
CryptoPolicy, module hashes, native-asset registry, allocations,
governance policy, ceremony references, and that the candidate hash is
not the testnet genesis hash.

## Supply

Default candidate supply is zero for SunRey Coin and MoonRey Coin.
There is no hidden premint, no inherited testnet faucet, and no
automatic migration of application Ledger balances. Fiat remains on the
canonical Ledger.
