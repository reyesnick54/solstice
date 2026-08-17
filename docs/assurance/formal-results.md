# Formal results

`FormalVerificationReport` is written to
`packages/sunrey-chain/formal/reports/<profile>.json`.

Result classifications:

- `VERIFIED_WITHIN_MODEL_BOUNDS`
- `COUNTEREXAMPLE_FOUND`
- `TOOL_ERROR`
- `NOT_ANALYZED`

The smoke campaign explores the eleven registered models with the
`FORMAL_SMOKE` bounds. Properties listed in the registry were
**model checked within stated bounds**. No open counterexamples are
recorded for that campaign.

This is not a claim that SunRey is fully formally verified,
mathematically proven secure, unbreakable, or bug free.

Safe public fields are exposed to the operations dashboard
`FORMAL_ASSURANCE`. Internal secrets are not included.
