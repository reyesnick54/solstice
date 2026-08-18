# Public RPC

Public RPC runs in the canonical `PUBLIC_RPC` network zone.

It has no direct access to:

- consensus signers
- validator administration
- custody signing
- governance keys

## Request classes

- `PUBLIC_READ`
- `TRANSACTION_SUBMISSION`
- `SUBSCRIPTION`
- `ARCHIVE_QUERY`
- `OPERATOR_AUTHENTICATED`

The public gateway never exposes internal operator methods.

## Routing

`RpcHealthRouter` chooses an endpoint from `RpcEndpointPool` using
health, sync state, load, request class, and archive requirements.
Stale nodes are excluded from mutation-eligibility and transaction
submission unless an explicit stale-read policy is set. That policy
defaults to forbidden.

## Submission and finality

Public submission accepts signed canonical transaction bytes only.
RPC never receives private keys.

Submission states:

- `ACCEPTED_FOR_MEMPOOL`
- `REJECTED`
- `ALREADY_KNOWN`
- `TEMPORARILY_UNAVAILABLE`

Mempool acceptance is not finality. Finalized transaction and block
status is a separate API (`chain.finality`).

## Environments

The same `/v1` API shape is used for local devnet and SunRey Testnet.
Each response labels the environment. Breaking API changes require a
new version prefix. `/v1` is preserved.

See [rpc-security.md](./rpc-security.md) and
[rpc-rate-limits.md](./rpc-rate-limits.md).
