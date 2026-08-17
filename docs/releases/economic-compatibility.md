# Economic compatibility

The economic RC verifies that current TypeScript and Rust SDKs can
read frozen economic policy versions and economic receipts:

- TypeScript: `MonetaryClient`, `FeeClient`, `ValidatorClient`,
  `ProductiveClient` in `packages/sunrey-sdk`.
- Rust: `monetary_policy`, `get_fee_policy`,
  `get_validator_economic_policy` in
  `packages/sunrey-chain/rust/crates/sdk`.

Explorer compatibility verifies display of monetary policy, supply,
validator economics, fees, MoonRey provenance, and treasury from the
RC projection APIs in `packages/sunrey-explorer`.

Comparison between economic RCs reports policy, schema, parameter,
formal, stress, and supply-behavior changes plus compatibility
status `IDENTICAL`, `COMPATIBLE`, or `BREAKING`.
