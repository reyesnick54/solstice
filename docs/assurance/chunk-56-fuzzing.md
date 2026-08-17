# Chunk 56 fuzzing and property assurance

SunRey is large enough that example unit tests are not enough. Chunk 56
adds a repeatable adversarial layer that runs only against development
and test-network code. `ENVIRONMENT` stays `simulation`. No `LIVE_*`
flag is enabled.

## What was added

- Protocol and parser fuzzing (TypeScript `decode` / `processTransaction`,
  Rust `UnsignedTransaction` / `SignedTransaction` / `BlockHeader` /
  `GenesisV1`, plus existing consensus and node libFuzzer targets)
- Consensus vote-set, certificate, WAL, and signer-safety properties
- Wallet/account, native-asset, fee, oracle, MoonRey, machine-commerce,
  exchange, and interoperability properties
- Language-neutral differential cases compared in TypeScript and Rust
- Replica state-root comparison on generated economic sequences
- `sunrey-test replay <fixture>` for permanent regression
- Minimal checked-in corpus and security fixtures
- `FUZZ_SMOKE` on PR CI and `FUZZ_EXTENDED` for local/nightly use

## Commands

```
npm run sunrey-test -- fuzz-smoke
npm run sunrey-test -- replay tests/assurance/fixtures/empty-decode.json
npm run test:fuzz-smoke
npm run test:fuzz-extended
npm run test:property
npm run test:differential
```

Rust:

```
cd packages/sunrey-chain/rust
cargo test -p sunrey-assurance --locked
cargo run -p sunrey-assurance --bin sunrey-test -- fuzz-smoke
```

libFuzzer (nightly / `cargo-fuzz`, not PR CI):

```
cd packages/sunrey-chain/rust/crates/protocol/fuzz
cargo fuzz run envelope_decoder
```

## Panic policy

Malformed network or user input must return a rejection. It must not
panic, crash the process, or allocate without an explicit bound.
Internal invariant violations fail the test clearly; they must not
silently corrupt state.

## Formal verification

This chunk is **not** full formal verification. Coverage statuses are
`IMPLEMENTED`, `PARTIAL`, or `NOT_APPLICABLE`. See
[`fuzz-targets.md`](./fuzz-targets.md).
