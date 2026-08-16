# ADR-0020 — SunRey Blockchain execution runtime architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0019, ADR-0031
- Implementation status: NOT_IMPLEMENTED

## Context

SunRey must not automatically inherit EVM semantics. Arbitrary
contracts that move native assets or mint "final" balances would
bypass the Compliance Kernel, class bridges, and consent firewall.

The protocol still needs later extensibility for application logic
that is *not* a safety-critical asset or policy path.

## Decision

### Placement of functions

| Function | Home |
| --- | --- |
| Fiat deposits, withdrawals, payments, holds, fees | Canonical Ledger + Kernel (`packages/ledger`, `services/accounts`, `packages/payments`) |
| Securities positions, paper orders | `packages/investments` + Ledger |
| Exchange matching, orders, trades | `packages/sunrey-exchange` (off-chain matching; settlement journals on Ledger) |
| Custody provider operations | `packages/custody` (operational, not ledger truth) |
| Consent grant / revoke | Consent Ledger (`packages/consent`) |
| Raw personal data | Personal Data Vault |
| Kernel proofs, Execution Authority | Compliance Kernel |
| Evidence sealing | Evidence Vault |
| Simulation chain receipts / anchors | `packages/sunrey-chain` today |
| Protocol-native objects (identity refs, attestations, consent receipts, policy version refs, evidence anchors, settlement anchors, oracle facts, productive-capacity commitments, rights/purpose refs) | Future **native modules** on SunRey Blockchain |
| Native SunRey Coin / MoonRey Coin units | Native asset module **only after** an explicit authority migration ADR; today SunRey Coin journals stay on the Ledger |
| Non-safety application extensions | Later **constrained deterministic WASM** |
| Generic EVM contracts | **Not adopted** |

### Runtime rules

1. **Primary execution** is application-specific transaction handlers
   in protocol-native modules. Handlers are versioned, reviewed, and
   part of the node TCB.
2. **Later extension** may add a deterministic WASM runtime for
   modules that cannot:
   - issue Execution Authority
   - post or rewrite canonical ledger journals
   - mint or burn native assets except through the native asset module
   - change legal-review status
   - activate mainnet or alter genesis
   - bypass admission / policy-aware validation
3. WASM gas/compute is metered. Floating-point is forbidden in
   deterministic contexts. Host functions are an allow-list.
4. Smart contracts are not a substitute for the Kernel. A contract
   ALLOW is not a Kernel ALLOW.
5. No EVM, no Solidity opcode compatibility goal, no implicit
   reentrancy model.

## Alternatives considered

- **EVM as the execution engine.**
- **WASM-only from day one, including assets and consensus hooks.**
- **Native modules only, forever, no user programs.**
- **Move / Cadence as the first runtime.**

## Why rejected

- EVM imports a token-and-contract worldview and a large attack
  literature SunRey does not need as the base layer.
- WASM-only for assets puts mint/burn in user programs.
- Native-only forever blocks later extensibility the protocol should
  allow *outside* safety boundaries.
- Move/Cadence are credible but would couple SunRey to another
  platform's object model before the native economic objects exist.
  They remain research alternatives, not the freeze.

## Security implications

User programs are untrusted. Host functions that read "policy ALLOW"
must not be forgeable. Metering bugs are liveness/DoS risks.
Reentrancy is avoided by not adopting EVM call semantics for native
asset mutation.

## Compliance implications

A WASM program cannot be a regulated product by existing. Listing or
offering user programs may later need counsel. `RESEARCH_REQUIRED`.

## Operability implications

Native module upgrades are protocol upgrades (ADR-0028). WASM module
registry, if added later, needs deterministic code hashes and no
silent replace.

## Migration implications

No contracts exist to migrate. Simulation `ChainWriteIntent` handlers
are the conceptual ancestors of native modules, not a WASM ABI.

## Unresolved questions

- WASM interpreter versus ahead-of-time compile-to-deterministic-ISA.
- Whether any native module is implemented in Chunk 32 or only
  interfaces.

## Status

`ACCEPTED_FOR_ENGINEERING` for native-module-first execution and
non-EVM stance. Production runtime: **not implemented**. Legal
confidence: `RESEARCH_REQUIRED`.
