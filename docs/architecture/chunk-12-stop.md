# Chunk 12 stop record (historical)

This file preserves the **historical constitutional stop** from the first
Chunk 12 attempt. It is not the current completion report.

Task: Mobile Wallet Provisioning, Network Token Lifecycle, Apple Pay /
Google Wallet Adapter Architecture, and Tap-to-Pay / SoftPOS Acceptance
Foundation.

The first Chunk 12 agent inspected `main` while Cards was still
`PLANNED` / absent. Under the architecture dependency rule it correctly
stopped rather than inventing a second cards domain. That stop-only
change later merged **after** Chunk 11 Cards had already become
`IMPLEMENTED`, which left `main` internally inconsistent.

**Current status:** Cards is `IMPLEMENTED` at `packages/cards` and
`services/cards`. Chunk 12 was subsequently resumed (Chunk 12R) inside
that canonical Cards boundary. See
[`chunk-12-resume.md`](./chunk-12-resume.md).

Do not treat this file as evidence that Cards is absent, or that
Chunk 12 must still stop.

---

## Historical baseline (unchanged)

Inspected HEAD at the original stop: `c313bec` —
`feat(payments): add FX and cross-border payment orchestration (#28)`.

At that tip there was no `packages/cards`, no `services/cards`, and
capability `cards` was `PLANNED`. `evaluateChunkRequirements` returned
`mustStop: true`.

A concurrent cloud agent named "Canonical card platform" was running
but had not merged. Concurrent work is not canonical until it lands on
`main` as `IMPLEMENTED`.

The original stop added:

- this file
- `docs/architecture/chunks/chunk-12-mobile-wallet-and-tap-to-pay.json`
- a linter test asserting `CHUNK-12` `mustStop`s while `cards` is
  `PLANNED`

Those artifacts were correct **then**. They became stale once Cards
merged.

## What the original stop correctly refused

- A second cards domain (`packages/wallet`, `packages/tokenization`,
  a parallel card object)
- Manual wallet / EMV / contactless cryptography
- Apple or Google certification claims
- Live acquiring or issuing claims

Those refusals remain binding for the resumed implementation.

## Resume rule

Once `cards` is `IMPLEMENTED` on `main`:

1. `evaluateChunkRequirements` for CHUNK-12 must return
   `mustStop: false`.
2. Wallet / tokenization lives inside the canonical Cards owner.
3. Tap-to-Pay / SoftPOS is a separate acceptance module that still
   reuses Identity, Kernel, ledger, events, and evidence.
4. Consumer wallet provisioning and merchant acceptance stay
   architecturally separate.
6. Keep `ENVIRONMENT=simulation` and every `LIVE_*` flag `false`.
7. Do not claim Apple, Google, network, acquirer, PCI, or
   regulatory approval.

Chunk 13 should not be scoped until Chunk 12 can start from an
`IMPLEMENTED` Cards owner.

## AB. Addendum after Chunk 11 merged (2026-08-15)

PR `#31` landed the canonical cards owner. On `main` at `f304ef8`:

- capability `cards` is `IMPLEMENTED`
- bounded context CARDS is `PARTIAL`
- `evaluateChunkRequirements` for CHUNK-12 returns `mustStop: false`

Recommendation steps 1–3 above are done. Steps 4–7 (wallet /
SoftPOS inside Cards) were not executed. The Chunk 12 stop PR
(`#29`) merged after cards and left a stale test asserting
`cards === PLANNED`, which is why `main` CI went red.

Chunk 13 inspected that tip, found the three process gates still
failed, and stopped. See [`chunk-13-stop.md`](./chunk-13-stop.md).
5. `ENVIRONMENT=simulation` and every `LIVE_*` flag stay `false`.
