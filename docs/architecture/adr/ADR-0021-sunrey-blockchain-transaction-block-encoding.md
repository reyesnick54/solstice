# ADR-0021 — SunRey Blockchain transaction and block encoding

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0019, ADR-0024
- Implementation status: NOT_IMPLEMENTED

## Context

Deterministic execution requires a canonical encoding. Ad-hoc JSON
with unordered maps and implicit defaults causes `app_hash` splits.
SunRey already canonicalizes some simulation payloads; production
blocks need explicit versioning.

## Decision

1. Every transaction and block has a **versioned envelope**:

   ```text
   EnvelopeV1
     network_id
     chain_id
     codec_id
     schema_version
     body
     auth (signatures / multi-sig / future PQC hybrid)
   ```

2. Codecs are identified by `codec_id`. The engineering direction is
   an established binary schema (Protocol Buffers or an equivalent
   widely implemented IDL) plus a **canonical hash** over a strictly
   specified byte encoding. Human-readable JSON is a debug projection,
   not the consensus encoding.
3. Unknown fields in a given `schema_version` are rejected, not
   ignored, unless a later upgrade ADR defines a documented extension
   range.
4. Transaction types are a closed enum at each protocol version.
   New types require a protocol upgrade.
5. Block header includes: height, previous block hash, `app_hash`,
   transaction root, validator-set hash, consensus parameters hash,
   time (UTC, integer seconds or milliseconds — one unit, no floats),
   and network/chain IDs.
6. Replay protection: `(network_id, chain_id, account/nonce or
   content-addressed idempotency key)` as specified per tx type.
   Cross-network replay is structurally invalid.

## Alternatives considered

- **Canonical JSON only.**
- **SSZ (Ethereum) as the only codec.**
- **BCS (Move) as the only codec.**
- **Unversioned protobuf with ignored unknown fields.**

## Why rejected

- JSON as consensus encoding is fragile (key order, number
  representation, Unicode).
- SSZ or BCS could be adopted later; freezing one ecosystem codec
  before the node language and libraries are chosen is premature.
  The *requirement* is versioned, established, canonical bytes.
- Ignoring unknown fields lets old nodes commit different state than
  new nodes.

## Security implications

Codec confusion (two encodings, one hash) is a double-spend /
equivocation primitive. Hashing must use a single canonical
serialization. Signature payload is the hash of that serialization,
domain-separated by `network_id` and `chain_id`.

## Compliance implications

Encodings are not legal instruments. Retention of raw blocks for
audit is an operability and evidence question (ADR-0032).

## Operability implications

Debug JSON tools must never be used to re-encode a block for
consensus. Schema registries live in-repo and are hashed into
genesis.

## Migration implications

Simulation UUIDs and in-process records are not envelope v1
transactions. A translator, if ever written, is a one-way research
tool, not a mainnet migrator.

## Unresolved questions

- Protobuf versus an alternative IDL at implementation time.
- Exact nonce versus idempotency-key scheme per native module.

## Status

`ACCEPTED_FOR_ENGINEERING` for versioned envelopes and canonical
binary consensus encoding. Production codecs: **not implemented**.
Legal confidence: `RESEARCH_REQUIRED`.
