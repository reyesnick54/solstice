# SunRey light-client protocol

Development specification for Chunk 50. Not a production bridge.

## Trust model

A SunRey node stores a governed `ExternalChainDefinition` and an
`InterchainClientState`. Relayers submit header updates. The node
verifies:

1. The chain is registered and activatable
2. The header binds the expected external chain ID
3. The parent hash continues the verified header chain
4. Height advances by exactly one (future-height updates fail closed)
5. Finality signatures meet the configured quorum
6. The client is `ACTIVE` (not `FROZEN` or `EXPIRED`)

A malicious relayer cannot forge external state. Duplicate honest
submissions are idempotent.

## Operations

`LightClient`:

- `initialize_client`
- `verify_header`
- `verify_update`
- `verify_membership`
- `verify_non_membership`
- `latest_verified_height`
- `verify_finality`
- `detect_misbehavior`

Only verified headers become trusted inputs to membership proofs.

## Finality adapters

| Model | Development status |
| --- | --- |
| `SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN` | Fully implemented |
| `DETERMINISTIC_BFT` | Interface and fail-closed tests |
| `PROBABILISTIC_LONGEST_CHAIN` | Interface and fail-closed tests |
| `EXTERNAL_CHECKPOINT_FINALITY` | Interface and fail-closed tests |

Unimplemented models return `VERIFICATION_NOT_IMPLEMENTED`. They do
not pretend to verify a foreign protocol.

## Expiration and freeze

A client that exceeds its trusting period becomes `EXPIRED` and cannot
resume from an arbitrary new header. Recovery is a governed procedure.

Conflicting valid finality at the same height is misbehavior evidence.
The client becomes `FROZEN` and rejects new packets.

## Upgrades

Light-client upgrades require a new implementation/version, governance
authorization, a trust-continuity proof, and an activation height.
Proof rules never change silently.

## Crypto-agility

Foreign verification uses `ExternalCryptoVerifier` with an explicit
algorithm identifier. SunRey-side control messages still use the
canonical SunRey CryptoSuite. Interop security cannot exceed the
weakest required trust domain.
