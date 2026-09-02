# Wave 9 — Blockchain Adversarial Report

Date: 2026-09-02  
Scope: SunRey sovereign blockchain core (simulation / local / sandbox only)  
Environment: `ENVIRONMENT=simulation`; all `LIVE_*` flags remain `false`  
Reference architecture: Wave 2 sovereign blockchain completion, Wave 3 proof-bound monetary transitions

---

## Executive summary

Wave 9 executed aggressive adversarial testing across transaction security, double-spend resolution, issuance replay, validator/consensus semantics, state determinism, block integrity, storage atomicity, snapshot/sync trust, native-asset isolation, supply invariants, and adversarial throughput.

**Result:** No critical or high-severity defects enabling unauthorized canonical supply mutation were found. One **medium** residual gap (protocol actor-to-key binding) and one **low** operational note (issuance replay deferred to block apply) are documented below with regression tests.

**Verdict:** `WAVE 9 BLOCKCHAIN ADVERSARIAL: PASS WITH DOCUMENTED RESIDUALS`

---

## Methodology

| Layer | Harness |
| --- | --- |
| TypeScript protocol / proof-bound / deterministic state | `tests/wave-9-blockchain-adversarial.test.ts` |
| Rust LocalNode / native assets / admission | `packages/sunrey-chain/rust/crates/node/tests/wave9_adversarial.rs` |
| Existing Wave 2 suites | `wave2_failures.rs`, `production.rs`, `abuse.rs`, `consensus_network.rs`, `phase-g-red-team.test.ts`, `proof-bound.test.ts` |

Validation commands:

```bash
npm run test:blockchain
cd packages/sunrey-chain/rust && cargo test --workspace --locked
cd packages/sunrey-chain/node && cargo test --locked
node --test tests/wave-9-blockchain-adversarial.test.ts
```

---

## Task 1 — Transaction attacks

| Attack | Result |
| --- | --- |
| Unsigned transaction | REJECTED (`INVALID_SIGNATURE` / admission failure) |
| Forged / malformed signature | REJECTED (byte mutation breaks verify) |
| Modified signed payload | REJECTED |
| Replay (same envelope) | REJECTED (`REPLAY`) |
| Nonce skip / stale sequence | REJECTED (`INVALID_SEQUENCE` / `Replay` at node) |
| Wrong chain / network | REJECTED |
| Wrong protocol / schema version | REJECTED |
| Oversized envelope | REJECTED |
| Unknown protobuf fields | REJECTED (`MALFORMED`) |
| Zero-value / zero sequence | REJECTED (`INVALID_QUANTITY` / `INVALID_SEQUENCE`) |
| Asset ID / purpose substitution (SunRey ↔ MoonRey) | REJECTED |
| Wrong sender key (valid sig, wrong key) | **ACCEPTED at protocol admission** — see Finding W9-001 |

**Unauthorized canonical mutations:** 0 (excluding documented W9-001 transfer-shape gap).

---

## Task 2 — Double-spend attacks

| Scenario | Result |
| --- | --- |
| Conflicting transfers, same nonce (sequential) | Second transfer REJECTED (`INVALID_NONCE`) |
| Conflicting transfers, same nonce (parallel admission) | Exactly one admitted; other `Replay` (Rust `concurrent_same_nonce_admits_only_one`) |
| Replay of executed transfer | REJECTED (`REPLAY_TRANSACTION`) |
| Deterministic state root after parallel first-wins paths | MATCHING |

---

## Task 3 — Issuance replay

| Artifact replayed | Result |
| --- | --- |
| Monetization key (proof-bound SunRey) | REJECTED (`CLAIM_ALREADY_MONETIZED` / `DUPLICATE_MONETIZATION_KEY`) |
| Consumption store after disk persist + log replay | Key remains consumed |
| Issuance authorization ID (native faucet) | Second mint REJECTED at block apply; supply unchanged |
| Identical signed transaction after node restart | REJECTED (`Replay`) |

---

## Task 4 — Validator adversarial tests

Covered by existing Rust/TS suites (not reimplemented in Wave 9):

| Scenario | Result |
| --- | --- |
| Validator offline (3-of-4) | Finalizes (`one_validator_offline_still_finalizes`) |
| Invalid transaction in proposal | Empty proposal / no commit |
| Wrong application hash | REJECTED |
| Forged equivocation evidence | REJECTED |
| Wrong genesis / network handshake | REJECTED |
| Invalid validator signature | Vote REJECTED |

---

## Task 5 — Consensus quorum

| Scenario | Result |
| --- | --- |
| Below quorum (1-of-4 online) | No finality (`quorum_not_reached_without_majority`) |
| At/above quorum (3-of-4) | Finalizes with matching `app_hash` |
| False finality without certificate | Not exposed; `FINALIZED` requires `CommitCertificate` |

---

## Task 6 — State determinism

| Vector | Result |
| --- | --- |
| Identical transaction history | Matching `monetaryStateRoot` |
| Canonical encode/decode round-trip | MATCHING |
| Independent LocalNode genesis | MATCHING before divergent history |
| Concurrent admission ordering | First-wins; roots deterministic |

---

## Task 7 — Block attacks

| Attack | Result |
| --- | --- |
| Wrong parent / height | REJECTED (`IncorrectParent` / `IncorrectHeight`) |
| Wrong transaction root | REJECTED |
| Wrong state / app hash | REJECTED |
| Wrong evidence root | REJECTED (`evidence root mismatch`) |
| Unsupported protocol version | REJECTED |
| Tampered block id | REJECTED |

---

## Task 8 — Storage attacks

| Attack | Result |
| --- | --- |
| Crash before/during commit | Prior state preserved |
| Crash after commit | New state preserved |
| Corrupted block/state/meta | Detected on open or `verify_integrity` |
| Partial migration | No published partial destination DB |

---

## Task 9 — Snapshot / sync attacks

| Attack | Result |
| --- | --- |
| Tampered snapshot payload | REJECTED (`SNAPSHOT_TAMPER`) |
| Wrong-network trust binding | REJECTED (`WRONG_NETWORK_SNAPSHOT`) |
| Peer-reported balance | REJECTED (never trusted) |
| State root mismatch vs trust | REJECTED |

---

## Task 10 — Asset isolation

| Attack | Result |
| --- | --- |
| SunRey proof → MoonRey issuance | REJECTED (`SUNREY_PROOF_FOR_MOONREY`) |
| MoonRey transfer without MoonRey balance | No balance movement (block apply fail-closed) |
| Cross-purpose native transfer shapes | REJECTED at protocol layer |
| Separate issuance policy / associated layer metadata | Enforced in registry |

---

## Task 11 — Supply invariants

| Invariant | SUNREY_COIN | MOONREY_COIN |
| --- | --- | --- |
| Non-negative supply | PASS | PASS |
| Holdings reconcile | PASS | PASS |
| Issuance replay blocked | PASS | PASS |
| Cross-asset contamination | PASS | PASS |
| Restart serialization preserves root | PASS | PASS |

---

## Task 12 — Adversarial throughput

| Flood type | Result |
| --- | --- |
| Invalid signature / wrong-network (200×) | 100% rejected; no height advance |
| Invalid sequence flood (500× TS) | 100% rejected; >50 validations/sec |
| Mempool capacity (existing productization) | Bounded; no panic |

---

## Security findings and remediation

### W9-001 — Protocol actor-to-key binding gap (Medium)

| Field | Value |
| --- | --- |
| Severity | Medium (simulation protocol layer) |
| Root cause | `validateAuthentication` verifies Ed25519 over canonical bytes but does not bind `authentication.publicKey` to `header.actor` credentials |
| Exploit | Attacker with any valid signing key can submit a transfer-shaped envelope naming another actor if rights/policy preconditions are otherwise satisfied |
| Fix | **Not implemented in Wave 9** — requires wallet/account registry integration at protocol admission (Chunk 46 boundary). Documented in regression test as `KNOWN_GAP_ACTOR_KEY_BINDING`. |
| Regression test | `tests/wave-9-blockchain-adversarial.test.ts` Task 1 |

### W9-002 — Issuance replay admitted to mempool (Low)

| Field | Value |
| --- | --- |
| Severity | Low |
| Root cause | `IssuanceReplay` enforced in `apply_native_asset` at block execution, not at `admit()` |
| Exploit | Duplicate issuance authorization can occupy queue space; block apply rejects; supply unchanged |
| Fix | **No code change** — behavior is fail-closed on supply; optional future hardening: reject at admission |
| Regression test | `wave9_adversarial.rs` `duplicate_issuance_authorization_rejected_at_block_apply` |

### Defects fixed in Wave 9

No production code defects required patching. Wave 9 added regression coverage only.

---

## Remaining defects

| ID | Severity | Status |
| --- | --- | --- |
| W9-001 | Medium | Open — actor/key binding at protocol admission |
| W9-002 | Low | Accepted — mempool admit vs block-apply split |

No **critical** or **high** open defects from this campaign.

---

## Files changed

| File | Change |
| --- | --- |
| `tests/wave-9-blockchain-adversarial.test.ts` | New Wave 9 TS adversarial suite |
| `packages/sunrey-chain/rust/crates/node/tests/wave9_adversarial.rs` | New Wave 9 Rust LocalNode suite |
| `docs/security/WAVE9_BLOCKCHAIN_ADVERSARIAL_REPORT.md` | This report |

---

## Validation results

| Suite | Result |
| --- | --- |
| `tests/wave-9-blockchain-adversarial.test.ts` | 10/10 pass |
| `cargo test --test wave9_adversarial` | 6/6 pass |
| `npm run test:blockchain` | 1968/1968 pass |
| `cargo test --workspace --locked` | All pass |
| `cargo test` (sunrey-chain/node) | All pass |

---

## References

- `docs/architecture/WAVE2_SOVEREIGN_BLOCKCHAIN_COMPLETION_REPORT.md`
- `docs/architecture/WAVE3_PROOF_BOUND_MONETARY_TRANSITIONS.md`
- `docs/security/sunrey-blockchain-threat-model.md`
- `docs/security/audit-readiness/threat-model-stride.md`
