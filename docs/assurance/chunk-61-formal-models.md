# Chunk 61 — Formal models and bounded model checking

SunRey now has a formal-assurance layer for its highest-risk consensus
and economic invariants. The selected tool is **TLA+/TLC 1.8.0**.
Selected Rust bounded verification uses **Kani 0.65.0** harness shapes.
CI smoke explores the checked-in TLA+ transition systems with a
deterministic explicit-state twin and runs exhaustive Rust tests of the
same small domains.

This is **not** whole-system formal verification. Properties were
**model checked within stated bounds**.

## Commands

```
npm run sunrey-formal -- smoke
npm run test:formal-smoke
npm run test:formal-extended
```

Rust:

```
cd packages/sunrey-chain/rust
cargo test -p sunrey-formal --locked
```

## What was added

- Eleven TLA+ models under `packages/sunrey-chain/formal/tla/`
- `FormalModelRegistry`
- Deterministic `FORMAL_SMOKE` / `FORMAL_EXTENDED` profiles
- Implementation-trace export and conformance
- Model/code constant alignment tests
- Bounded Rust harnesses for quorum, asset, fee, signer, and settlement
  arithmetic
- Machine-readable `FormalVerificationReport`
- Safe dashboard input `FORMAL_ASSURANCE`

## Claim language

Use only:

> model checked within stated bounds

Do not claim: fully formally verified, mathematically proven secure,
unbreakable, or bug free.
