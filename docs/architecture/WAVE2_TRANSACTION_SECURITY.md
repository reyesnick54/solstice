# Wave 2 — Transaction Security

Status: IMPLEMENTED (simulation)  
Owner: `packages/sunrey-chain/src/protocol`  
Depends on: ADR-0019 (state machine), ADR-0022 (storage), Chunk 32R SRCB v1 envelope

## Purpose

Establish a secure transaction lifecycle **before** distributed consensus is introduced. A protocol transaction must become a cryptographically authenticated, deterministic instruction that can safely move through:

```
creation → signing → submission → stateless validation → stateful validation
→ mempool → block inclusion → execution → finalization
```

No unsigned or replayed transaction may modify canonical monetary state.

## Transaction envelope

The canonical envelope is **SRCB v1** (`EnvelopeV1`):

| Field | Role |
| --- | --- |
| `networkId` | Environment binding (simulation vs testnet vs production candidate) |
| `chainId` | Chain instance within the network |
| `codecId` | `sunrey.protobuf.canonical.v1` — deterministic protobuf codec |
| `schemaVersion` | Protocol version (`1`) |
| `transactionType` | Transaction family (e.g. `NATIVE_ASSET`) |
| `body` | Typed family payload with `BodyHeader` |
| `authentication` | Ed25519 signature descriptor |

**Transaction ID** is a domain-separated SHA-256 over canonical unsigned bytes:

```
SUNREY_TX_V1 || networkId || chainId || schemaVersion || encodeUnsignedEnvelope(envelope)
```

Debug JSON projections are **not** hash inputs.

## Canonical serialization

- Wire encoding: `packages/sunrey-chain/src/protocol/codec.ts`
- Schema contract: `packages/sunrey-chain/schemas/srcb-v1.json`
- Test vectors: `packages/sunrey-chain/protocol/test-vectors/v1/vectors.json`

Identical semantic input must produce identical bytes and identical transaction IDs.

## Signature model

Signatures use the canonical **transaction signing digest**:

1. Build a binding payload: `networkId`, `chainId`, `schemaVersion`, `codecId`, `transactionType`, unsigned envelope bytes
2. Domain-commit with `sunrey.sig.transaction.v1` (`SIGNATURE_DOMAINS.TRANSACTION`)
3. SHA-256 the commit → 32-byte Ed25519 message

Implementation:

- `packages/sunrey-chain/src/protocol/signing.ts`
- `packages/sunrey-chain/src/protocol/authentication.ts`
- Crypto provider: `packages/security` Ed25519 (`sunrey-ed25519-v1`)

Private keys never enter canonical chain state or application logs.

## Domain separation

Signatures cannot be replayed across:

| Axis | Enforcement |
| --- | --- |
| Chain ID | Binding payload + `SUNREY_TX_V1` hash domain |
| Network / environment | `networkId` in binding and hash domain |
| Protocol version | `schemaVersion` in binding |
| Transaction type | `transactionType` in binding |
| Payload | Full unsigned canonical bytes |

A development transaction signed on `net_sunrey_simulation` is not valid on a future mainnet even if keys coincide.

Wallet protocol signing uses `signProtocolDigest` (no wallet-domain wrapper) so signatures verify through `verifyEnvelopeSignature`.

## Nonce / sequence behavior

Account sequencing uses `BodyHeader.sequence`:

| Rule | Behavior |
| --- | --- |
| Expected sequence | `lastExecutedSequence + 1` |
| Stale (replay) | `sequence < expected` → `INVALID_SEQUENCE` |
| Future gap | `sequence > expected + 1` → `INVALID_SEQUENCE` |
| Advance | Only after successful execution (`recordAccepted`) |
| Failed execution | Mempool entry removed; sequence not advanced |
| Restart | `AccountSequenceTracker.restore()` reloads executed sequences |
| Concurrent submit | `reserve()` rejects conflicting pending sequence for same account |

Client-side `NonceManager` in the wallet coordinates pending/submitted/finalized states but chain authority is `ProtocolState`.

## Mempool responsibility

`ProtocolMempool` (`packages/sunrey-chain/src/protocol/mempool.ts`) is **not canonical state**.

Admission runs (in order):

1. Size limit (`MAX_ENVELOPE_BYTES`)
2. Decode
3. Envelope binding (network/chain)
4. Stateless validation
5. Authentication (signature)
6. Replay guard (tx-id, idempotency, sequence, expiry)
7. Capacity / per-actor limits

The mempool does **not** mutate supply or balances. Block selection is deterministic fee-priority with `txId` tie-break.

Execution validation (`validateStateful` + `applyStateTransition`) runs only when a transaction is executed from the mempool into a block.

## Issuance replay protection

Issuance and burn require stronger replay protection than transfers.

`ConsumedAuthorizationRegistry` tracks `(assetId, issuanceClass, authorizationId)` tuples. The same authorization identifier must never create supply twice.

Economics-layer issuance (`packages/sunrey-chain/src/economics/issuance.ts`) and Rust native-assets (`used_authorizations`) mirror this policy. Protocol `ISSUE`/`BURN` operations remain gated until explicitly activated.

## Transaction status semantics

| Stage | Meaning |
| --- | --- |
| `CREATED` | Unsigned envelope passed stateless checks |
| `SIGNED` | Valid signature attached |
| `SUBMITTED` | Accepted into mempool boundary |
| `ACCEPTED` | Admission validation passed (not finality) |
| `REJECTED` | Failed validation or execution |
| `INCLUDED` | Selected for a block |
| `EXECUTED` | Stateful validation + apply succeeded |
| `FINALIZED` | Commit certificate observed |

**Mempool admission alone is not finality.** APIs must not report `FINALIZED` from acceptance alone.

Receipts: `packages/sunrey-chain/src/protocol/receipt.ts`  
Lifecycle orchestration: `packages/sunrey-chain/src/protocol/lifecycle.ts`

## Cross-asset isolation

Stateless validation rejects:

- `sunrey.native-asset.transfer` operations on `MOONREY_COIN`
- `moonrey.*` purposes on `SUNREY_COIN`

SunRey transactions cannot mutate MoonRey state and vice versa through mismatched purpose/asset pairs.

## Application commands that are not chain transactions

These must not be confused with SRCB v1 transactions:

- `ChainWriteIntent` — HMAC-signed trust-layer writes (`CHAIN_OPERATION_SIGNING`)
- `SunReyChainService` simulation receipts
- Custody `WalletTransaction` read models
- Productive `MoonReyIssuanceAuthorization` pre-gates

## Tests

`tests/wave-2-transaction-security.test.ts` covers:

- Valid / invalid signatures
- Altered payload rejection
- Wrong chain, network, protocol version
- Duplicate transactions and nonce replay
- Skipped nonce and restart recovery
- Issuance authorization replay
- Malformed payload and public key
- Cross-asset isolation
- Full lifecycle through finalization
- Mempool admission vs finality

Regenerate language-neutral vectors after signing changes:

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning \
  packages/sunrey-chain/protocol/test-vectors/v1/generate-vectors.ts
```

## Related documents

- [ADR-0019 — State machine architecture](./adr/ADR-0019-sunrey-blockchain-state-machine-architecture.md)
- [ADR-0022 — Storage model](./adr/ADR-0022-sunrey-blockchain-storage-model.md)
- [Blockchain storage engine](../storage/blockchain-storage-engine.md)
- [SunRey blockchain cryptography](../security/sunrey-blockchain-cryptography.md)
