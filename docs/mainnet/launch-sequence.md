# Launch sequence

The rehearsal boot sequence is deterministic and operator-driven. These
are workflow labels. No background scheduler is required.

## T-minus phases

1. `T_MINUS_24H`
2. `T_MINUS_4H`
3. `T_MINUS_1H`
4. `GENESIS`
5. `POST_GENESIS_15M`
6. `POST_GENESIS_1H`
7. `STABILITY_WINDOW`

## Validator boot order

1. Verify release artifacts (commit, digest, SBOM, provenance, compatibility)
2. Verify rehearsal genesis
3. Verify signer fencing (active/passive)
4. Verify network policy
5. Launch sentries
6. Launch validators
7. Establish peer connectivity
8. Observe consensus
9. Launch public RPC
10. Launch Explorer
11. Launch ancillary services

Consensus participation begins only when configured rehearsal launch
conditions are satisfied.

## Independent genesis checks

Every validator verifies network, chain, genesis hash, validator set,
CryptoPolicy, module hashes, fee policy, native asset registry, and
governance policy before participating.
