# Formal model registry

Machine-readable catalog: `packages/sunrey-chain/formal/registry/formal-model-registry.json`.

| Model ID | Tool | Smoke bounds | Properties |
| --- | --- | --- | --- |
| CONSENSUS_SAFETY | TLA+/TLC 1.8.0 | 3 validators, height 1, round 1 | conflicting finality, monotonic height, quorum, duplicate vote, wrong height/round/set, lock, NIL |
| SIGNER_SAFETY | TLA+/TLC 1.8.0 | height 2, round 1 | one coordinate one value, conflict refused, restore does not roll back |
| VALIDATOR_SET_TRANSITION | TLA+/TLC 1.8.0 | 4 validators, 2 epochs | mid-epoch stability, rotation, power once, deterministic hash |
| PROTOCOL_GOVERNANCE | TLA+/TLC 1.8.0 | 3 voters, height 3 | immutable content, votes once, power, activation height, no AI auth, binary install |
| NATIVE_ASSET_CONSERVATION | TLA+/TLC 1.8.0 | quantity 2 | issued − burned = circulating + locked |
| FEE_CONSERVATION | TLA+/TLC 1.8.0 | quantity 2 | reserved = charged + released |
| EXCHANGE_ATOMIC_DVP | TLA+/TLC 1.8.0 | quantity 2, 1 order | atomic legs, no double settle, conservation |
| MOONREY_ISSUANCE | TLA+/TLC 1.8.0 | quantity 2 | uniqueness, fingerprint reorder, limits |
| MOONREY_POLICY_GOVERNANCE | TLA+/TLC 1.8.0 | quantity 2, 2 epochs | uniqueness, caps, activation, eligibility, supply, cross-category |
| INTEROP_PACKET_STATE | TLA+/TLC 1.8.0 | 2 packets | at most once send/ack, frozen client |
| INTEROP_ASSET_CONSERVATION | TLA+/TLC 1.8.0 | DEV_INTEROP_TEST_ASSET quantity 3 | circulating + escrowed + remote = total |
| CRYPTO_POLICY_MIGRATION | TLA+/TLC 1.8.0 | five Chunk 60 states | governed transitions only |

Each record stores model version, implementation references, assumptions,
state bounds, properties, tool, tool version, last result, and source
commit.
