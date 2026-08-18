# Institutional order gateway

The gateway is an authenticated, sequenced, idempotent order port.

## Session

A `TradingCredential` identifies participant, account, market
permissions, environment, and session. It cannot contain custody
private keys. Production trading requires trading/account authority;
a developer API key cannot move production funds.

## Messages

- Logon / logout
- New order, cancel, cancel/replace
- Order status
- Session recovery (last inbound/outbound sequence + open orders)
- Mass cancel (participant or operator)
- Cancel-on-disconnect (institutional sessions only; sandbox/retail
  default off)

## FIX-style adapter

Tag mapping is compatible with FIX-style semantics (`35=A/D/F/G/H/2`).
This is not a FIX certification.

## WebSocket-style adapter

JSON frames for approved trading clients. Same sequencing and
idempotency rules. No custody keys on the wire.
