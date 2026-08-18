# Production genesis manifest

`ProductionGenesisManifest` binds the inputs required to compute a
deterministic production-genesis candidate.

JSON display format is not consensus serialization.

## Bound fields

- network ID and chain ID
- protocol version
- exact Mainnet RC id and hash
- exact Candidate V2 id and root hash
- validator set hash
- validator and governance key hashes
- production CryptoPolicy (Chunk 84 / production-candidate policy)
- economic, fee, and treasury policy identifiers
- Chunk 71 `GenesisAssetAllocationManifest`
- governed genesis-time procedure
- module hashes
- ticker status `NOT_ASSIGNED`

## Allocation

If production allocations remain unapproved, the production genesis
package remains incomplete. The architecture does not invent quantities
and does not copy rehearsal allocation.

## Time

Genesis time is a governed procedure. The ceremony does not read an
arbitrary developer-local clock. Actual production time selection
remains part of the authorized launch procedure.

## Hash

Canonical bytes are domain-separated and length-prefixed. The genesis
candidate hash is SHA-256 of those bytes. Every participant can
independently verify the same value. Changing validator keys, voting
power, Mainnet RC, Candidate V2, economic policy, allocation,
CryptoPolicy, network ID, or chain ID changes the hash.
