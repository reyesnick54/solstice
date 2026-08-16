# Chunk 34 — SunRey local node core

Local development / simulation node. Not a production blockchain.

## Flow

genesis → boot → admit → validate → execute → `DEV_BLOCK_PRODUCER`
constructs a block → state commitment → atomic persist → restart
recovers the same height and app hash.

## Identifiers

| Field | Value |
| --- | --- |
| network id | `net_sunrey_local_dev` |
| chain id | `chn_sunrey_local_dev` |
| codec | `srcb.v1` |
| environment | `simulation` |
| producer | `DEV_BLOCK_PRODUCER` |

Simulation trust-layer IDs (`chn_sunrey_simulation` /
`net_sunrey_simulation`) are not reused.

## Activated families

`SYSTEM`, `EVIDENCE_ANCHOR`. Other families return
`TRANSACTION_NOT_ACTIVATED`. Native asset definitions exist in genesis
with supply `0` and ticker `NOT_ASSIGNED`. No MoonRey supply.

## Storage

Embedded files under the node data directory. Not the customer
PostgreSQL financial databases.

## Crypto

`CryptoSuite` port only. First suite
`SUNREY_DEV_ED25519_SHA256` is `APPROVED_FOR_SIMULATION`. Fixture keys
are labeled not-for-production.
