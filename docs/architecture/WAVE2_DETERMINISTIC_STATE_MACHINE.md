# Wave 2 — Deterministic Canonical Protocol State Machine

**Status:** Wave 2 Prompt 1 implementation  
**Owner:** `packages/sunrey-chain/src/deterministic-state`  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`  
**Prerequisite:** Wave 1 exit gate PASS (`docs/architecture/WAVE1_COMPLETION_REPORT.md`)

This document defines the deterministic canonical protocol state machine
introduced in Wave 2. It is the foundation for validator consensus,
Monetary State Root commitments, and durable block replay. It does **not**
activate mainnet, production economics, or asset migration.

Canonical companions:

- [`SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md`](./SUNREY_SOVEREIGN_ARCHITECTURE_UPGRADE_PLAN.md)
- [`SUNREY_MONETARY_AUTHORITY_CONTRACT.md`](./SUNREY_MONETARY_AUTHORITY_CONTRACT.md)
- [`chunk-34-sovereign-node-core.md`](./chunk-34-sovereign-node-core.md)
- [`../economics/chunk-71-monetary-constitution.md`](../economics/chunk-71-monetary-constitution.md)

---

## 1. Purpose

Wave 2 Prompt 1 establishes a **deterministic canonical protocol state
machine** upon which validators and consensus can later operate:

```
Genesis State + Ordered Transactions + Protocol Version
  → identical Canonical Protocol State
  → identical canonical encoding
  → identical Monetary State Root
```

No wall-clock dependence, no random execution, no process-memory authority
for consensus-critical monetary state, no external API calls during state
execution, and no AI decisions inside consensus execution.

---

## 2. Canonical State Definition

`CanonicalProtocolState` (`deterministic-state/types.ts`) contains only
consensus-critical protocol information:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Canonical encoding schema (currently `1`) |
| `protocolVersion` | Active protocol version |
| `networkId` / `chainId` | Network identity |
| `height` | Current block height |
| `finalizedBlockId` | Latest finalized block identifier |
| `policyState` | Chunk 71 monetary policy state |
| `supplies` | `[SUNREY_COIN, MOONREY_COIN]` canonical supply books |
| `accountNonces` | Per-account transaction nonces |
| `executedTransactionIds` | Replay protection for transactions |
| `executedIssuanceAuthorizationIds` | Replay protection for issuance |
| `governanceAuthorizationRefs` | Governance references for monetary execution |

Each `CanonicalSupplyBook` holds integer supply totals, sorted account
positions, and sorted replay identifiers. No `Map`, `Set`, or mutable
class fields appear in the canonical form.

### Native assets

| Asset | Role |
| --- | --- |
| `SUNREY_COIN` | Protocol-native Human Economy asset |
| `MOONREY_COIN` | Protocol-native Productive Economy asset |

Both exist on **one** sovereign SunRey chain. Asset IDs cannot be
substituted; cross-asset balance contamination is rejected at reconcile time.

---

## 3. Non-Canonical Application State

The following are **not** canonical blockchain state and must not appear
in `CanonicalProtocolState`:

| Category | Examples | Authoritative owner |
| --- | --- | --- |
| Application ledger | Fiat journals, application SunRey Coin | `packages/ledger` |
| Exchange | Order books, quotes, portfolio projections | `packages/sunrey-exchange` |
| Raw HIN / contribution data | Personal attributes, raw observations | `packages/human-economic-contribution`, `packages/information-market` |
| Productive observations | Oracle feeds, facility readings | `packages/sunrey-chain/src/oracle`, `src/productive` |
| External API responses | Provider fixtures, macro/FX snapshots | `packages/external-data`, `packages/provider-sdk` |
| Evidence / rights payloads | Full PDV contents, consent plaintext | `packages/evidence`, `packages/personal-data-vault` |
| Trust-layer simulation receipts | `SimulationChainAdapter` operations | `packages/sunrey-chain/src/service.ts` |
| PostgreSQL customer databases | Identity, ledger, evidence rows | `packages/persistence` |

The Rust local development node (`packages/sunrey-chain/rust/crates/node`)
maintains additional namespaces (`NS_OBJECT`, `NS_EVIDENCE`, etc.) for
simulation. Wave 2 Prompt 1 canonicalizes the **monetary** plane in
TypeScript; full multi-root block commitments belong to Wave 3.

---

## 4. State Transition Lifecycle

```
┌─────────────┐     validate      ┌──────────────────────┐
│  Genesis    │ ────────────────► │ ValidatedNativeTx    │
│  State      │                   │ (TRANSFER/ISSUE/BURN)│
└─────────────┘                   └──────────┬───────────┘
       ▲                                     │
       │                          applyTransaction()
       │                                     ▼
       │                          ┌──────────────────────┐
       │                          │ CanonicalProtocolState│
       │                          │ (immutable, reconciled)│
       │                          └──────────┬───────────┘
       │                                     │
       │                          encodeCanonicalState()
       │                                     ▼
       │                          monetaryStateRoot()
       └──────── fail-closed ───── (invalid tx: no mutation)
```

Entry point:

```typescript
applyTransaction(previousState, validatedTransaction)
  → { ok: true, next } | { ok: false, code }
```

Batch helper: `applyTransactions(genesis, orderedTransactions)`.

Supported native operations:

| Operation | Mutates supply total | Notes |
| --- | --- | --- |
| `TRANSFER` | No | Conservation via `economics/operations.transfer` |
| `ISSUE` | Yes | Via Chunk 71 `authorizeIssuance` only |
| `BURN` | Yes | Via `authorizedBurn` with replay identifier |

Invalid transactions **fail closed** — the input state is not mutated.

---

## 5. Deterministic Encoding

`encodeCanonicalState` / `decodeCanonicalState`
(`deterministic-state/serialization.ts`):

- Fixed field ordering
- Unsigned big-endian integers (`u32`, `u64`)
- Length-prefixed UTF-8 strings
- Sorted repeated fields (positions, replay IDs, transaction IDs)
- No floating-point quantities
- No locale-dependent formatting
- No JavaScript object-key ambiguity

Integer monetary quantities use `bigint` minor units consistent with
`packages/money` and Chunk 71.

---

## 6. Monetary State Root

```typescript
monetaryStateRoot(state) → domain-separated SHA-256 hex
```

Domain: `SUNREY_MONETARY_STATE_V1` (registered in `protocol/constants.ts`).

The hash changes when consensus-critical monetary state changes and
remains identical when equivalent state is reconstructed from genesis +
transactions or from canonical bytes.

**Not in scope for Wave 2 Prompt 1:**

- Evidence Root
- Rights Root
- Policy Root

Those belong to Wave 3.

---

## 7. Monetary Invariants

`reconcileCanonicalState` verifies:

| Invariant | Check |
| --- | --- |
| `totalSupply >= 0` | `genesisAllocated + issuedPostGenesis - burned >= 0` |
| `circulatingSupply <= totalSupply` | Observed live classes ≤ expected total |
| `burnedSupply >= 0` | Non-negative burn counter |
| Account balances `>= 0` | No negative position components |
| Aggregate holdings reconcile | Sum of positions matches book totals |
| Asset isolation | Position `assetId` matches book `assetId` |
| Replay uniqueness | No duplicate transaction or issuance IDs |
| Nonce monotonicity | Nonces are non-negative and unique per account |

Supply mutations route through Chunk 71 `AssetSupplyBook` helpers;
`ProtocolNativeSupplyAuthority` exposes `toCanonicalState()` /
`fromCanonicalState()` for restart reconstruction.

---

## 8. Replay Protections

| Layer | Mechanism |
| --- | --- |
| Transactions | `executedTransactionIds` set |
| Issuance | `executedIssuanceAuthorizationIds` + per-book `usedReplayIds` |
| Burns | Per-book `usedReplayIds` with `BURN:{assetId}:{replayIdentifier}` |
| Account ordering | Strict nonce: `expected = lastNonce + 1` |

---

## 9. Prohibited Nondeterminism

The canonical state machine must **never** use:

- `Date.now()`, `performance.now()`, or wall-clock timestamps in transitions
- `Math.random()` or cryptographic randomness during execution
- Unordered `Map` / `Set` iteration as hash input
- `JSON.stringify` for consensus commitments
- Floating-point arithmetic for monetary quantities
- External HTTP, database, or filesystem reads during `applyTransaction`
- AI inference or agent decisions inside `applyTransaction`

---

## 10. In-Memory Authority Status

### Removed from consensus-critical path

| Before | After |
| --- | --- |
| `AssetSupplyBook.positions: Map` | `CanonicalSupplyBook.positions: sorted array` |
| `AssetSupplyBook.usedReplayIds: Set` | `CanonicalSupplyBook.usedReplayIds: sorted array` |
| `ProtocolNativeSupplyAuthority` as sole truth | `CanonicalProtocolState` is persistence-ready truth; authority is a mutable execution facade with export/import |

### Remaining in-memory (non-consensus or execution facade)

| Component | Role | Wave 2 follow-up |
| --- | --- | --- |
| `ProtocolState` (`protocol/state.ts`) | Non-monetary protocol families (rights, objects) | Integrate or scope separately in Prompt 2+ |
| `ProtocolNativeSupplyAuthority.books` | Mutable execution workspace | Export to canonical after each block |
| Rust `ChainView` / `NativeAssetLedger` | Local dev node simulation | Align TS/Rust roots in later prompt |
| Wallet engine `stateRoot()` | Ad-hoc holdings hash | Deprecate in favor of `monetaryStateRoot` |

---

## 11. State Mutation Entry Points

| Entry | Package path | Canonical? |
| --- | --- | --- |
| `applyTransaction` | `deterministic-state/transition.ts` | **Yes** |
| `authorizeIssuance` | `economics/issuance.ts` | Called only via `applyTransaction` ISSUE |
| `transfer` / `burn` | `economics/operations.ts` | Called only via `applyTransaction` |
| `authorizedBurn` | `native-assets/economic-controls.ts` | Called only via `applyTransaction` BURN |
| `ProtocolNativeSupplyAuthority.applyIssuance` | `native-assets/economic-controls.ts` | Facade; export via `toCanonicalState` |
| `Ledger.postJournal` | `packages/ledger` | **No** — application authority |
| `SimulationChainAdapter` | `packages/sunrey-chain/src` | **No** — trust-layer simulation |

---

## 12. Tests

`packages/sunrey-chain/src/deterministic-state/deterministic-state.test.ts`

Coverage includes:

- Identical genesis + transactions → identical state, encoding, and hash
- Transaction and issuance replay rejection
- Invalid transaction zero-mutation
- Transfer, burn, and issuance conservation
- SunRey / MoonRey asset isolation
- Process restart reconstruction via `ProtocolNativeSupplyAuthority`
- Transaction ordering determinism
- Forbidden actor rejection
- Reconcile property stability

---

## 13. Remaining Work (Wave 2)

| Item | Target prompt |
| --- | --- |
| Durable append-only block store wired to canonical state | Prompt 2 |
| Validator BFT consensus over state transitions | Prompt 2–3 |
| P2P transaction propagation | Prompt 3 |
| Full alignment of Rust `app_hash` and TS `monetaryStateRoot` | Prompt 2 |
| Integration of non-monetary `ProtocolState` families | Prompt 3+ |
| Evidence / Rights / Policy roots on blocks | Wave 3 |
| Production network activation | Post-Wave 9; never in Wave 2 |

---

## 14. Activation Prohibitions

Wave 2 Prompt 1 does **not**:

- Activate mainnet or testnet production networks
- Flip any `LIVE_*` flag or change `ENVIRONMENT`
- Execute production issuance or asset migration
- Change SunRey / MoonRey valuation methodology
- Modify PEVE, GPUV, HIN, or Exchange pricing
