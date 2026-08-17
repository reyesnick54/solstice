# SunRey formal-assurance area

Canonical formal models for the highest-risk SunRey protocol invariants
live here. Owner: `packages/sunrey-chain`.

This is not a second consensus engine, ledger, exchange, wallet, custody,
or verifier product.

Selected tool: **TLA+/TLC 1.8.0**, pinned in `tools/tla-pin.json` and
Chunk 59 toolchain pins. Bounded Rust checks use **Kani 0.65.0** harness
shapes; CI smoke runs equivalent exhaustive `cargo test` when Kani is
not on the default toolchain.

Results are **model checked within stated bounds**. This does not claim
that the entire SunRey system is formally verified.
