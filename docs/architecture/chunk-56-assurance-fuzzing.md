# Chunk 56 — SunRey fuzzing and deterministic property tests

Capability `sunrey-assurance` is `IMPLEMENTED` at the existing owner
`packages/sunrey-chain`.

This chunk adds an adversarial testing layer: protocol and parser fuzzing,
state-machine and economic property tests, TypeScript/Rust differential
drivers, deterministic replay, and CI smoke versus extended profiles.

It does **not** create a second blockchain, exchange, wallet, consensus,
or custody system. It does **not** claim formal verification.

## Owners

| Layer | Path |
| --- | --- |
| TypeScript harness | `packages/sunrey-chain/src/assurance/` |
| Rust driver | `packages/sunrey-chain/rust/crates/assurance/` |
| Protocol cargo-fuzz | `packages/sunrey-chain/rust/crates/protocol/fuzz/` |
| Consensus cargo-fuzz | `packages/sunrey-chain/rust/crates/consensus/fuzz/` |
| Node cargo-fuzz | `packages/sunrey-chain/node/fuzz/` |
| Regression corpus | `tests/assurance/corpus/` |
| Replay fixtures | `tests/assurance/fixtures/` |

## Profiles

- `FUZZ_SMOKE` — short deterministic corpus and property suite on PR CI
- `FUZZ_EXTENDED` — longer local / nightly / manual workflow

Ordinary PR CI must not run unbounded libFuzzer.

## Forbidden competing paths

Do not create `packages/sunrey-test`, `packages/fuzz`,
`packages/assurance`, `packages/sunrey-fuzz`, `packages/protocol-fuzzer`,
or `tools/sunrey-test`.
