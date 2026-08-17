# Interchain packet protocol

Development IBC-class packet protocol for Chunk 50.

## Identifiers

`InterchainClientId`, `InterchainConnectionId`, `InterchainChannelId`,
and `InterchainPacketId` all bind source chain, destination chain, and
protocol version. Packets from another network are invalid.

## Connection handshake

`INIT → TRY → ACK → CONFIRM` (then `OPEN`).

A connection records source client, destination client, protocol
version, capabilities, and proof requirements. There is no implicit
connection.

## Channels

Typed channels:

- `GENERIC_MESSAGE`
- `ECONOMIC_ATTESTATION`
- `ASSET_TRANSFER_RESERVED`
- `ORACLE_FACT`
- `IDENTITY_ATTESTATION_RESERVED`

High-risk capabilities remain explicit and governed.

Ordering: `ORDERED` enforces exact sequence. `UNORDERED` still requires
replay protection.

## Packet

Canonical binary encoding of:

sequence, source chain/channel, destination chain/channel, packet
type, payload, timeout height/timestamp, sender, receiver, protocol
version.

`payload_commitment` is a domain-separated hash of that encoding.

## Lifecycle

`SENT → RECEIVED → ACKNOWLEDGED` or `TIMED_OUT`.

One packet must not execute twice. Acknowledgements are
cryptographically bound to the packet commitment. Ack replay is
rejected.

## Timeouts

Fail closed. If delivery cannot be proven before timeout, the source
may transition according to packet policy only after a
non-membership (or equivalent) proof. Timeout does not blindly assume
foreign state.

## Relayers

Relayers read one chain and submit proofs to another. They pay
protocol resource fees where applicable. They hold no SunRey validator
key and no governance key. Multiple relayers may submit the same
packet safely.
