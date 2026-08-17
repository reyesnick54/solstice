# Formal results

`FormalVerificationReport` is written to
`packages/sunrey-chain/formal/reports/<profile>.json`.

Result classifications:

- `VERIFIED_WITHIN_MODEL_BOUNDS`
- `COUNTEREXAMPLE_FOUND`
- `TOOL_ERROR`
- `NOT_ANALYZED`

The smoke campaign explores the eleven registered models with the
`FORMAL_SMOKE` bounds (3 validators, height 1, round 1, quantity 2,
2 packets). Properties listed in the registry were **model checked
within stated bounds**. No open counterexamples are recorded for that
campaign.

| Model | States explored | Result |
| --- | ---: | --- |
| CONSENSUS_SAFETY | 7506 | VERIFIED_WITHIN_MODEL_BOUNDS |
| SIGNER_SAFETY | 52 | VERIFIED_WITHIN_MODEL_BOUNDS |
| VALIDATOR_SET_TRANSITION | 126 | VERIFIED_WITHIN_MODEL_BOUNDS |
| PROTOCOL_GOVERNANCE | 488 | VERIFIED_WITHIN_MODEL_BOUNDS |
| NATIVE_ASSET_CONSERVATION | 100 | VERIFIED_WITHIN_MODEL_BOUNDS |
| FEE_CONSERVATION | 21 | VERIFIED_WITHIN_MODEL_BOUNDS |
| EXCHANGE_ATOMIC_DVP | 3 | VERIFIED_WITHIN_MODEL_BOUNDS |
| MOONREY_ISSUANCE | 8 | VERIFIED_WITHIN_MODEL_BOUNDS |
| INTEROP_PACKET_STATE | 30 | VERIFIED_WITHIN_MODEL_BOUNDS |
| INTEROP_ASSET_CONSERVATION | 6 | VERIFIED_WITHIN_MODEL_BOUNDS |
| CRYPTO_POLICY_MIGRATION | 5 | VERIFIED_WITHIN_MODEL_BOUNDS |

Implementation traces for consensus, assets, DVP, MoonRey, governance,
and interop aligned. Rust bounded checks: 3/3 `cargo test -p sunrey-formal --locked`.

This is not a claim that SunRey is fully formally verified,
mathematically proven secure, unbreakable, or bug free.

Safe public fields are exposed to the operations dashboard
`FORMAL_ASSURANCE`. Internal secrets are not included.
