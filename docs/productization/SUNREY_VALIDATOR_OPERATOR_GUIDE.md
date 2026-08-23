# SunRey validator operator guide

This guide is for TESTNET and local/devnet operators. Mainnet remains
inactive. It does not authorize production, flip `LIVE_*` flags, or
replace the protocol validator registry.

Companion: `docs/productization/PHASE_G_03_SUNREY_CHAIN_RUNTIME.md`
and `docs/operators/validator.md`.

`ENVIRONMENT=simulation`
`MAINNET_ACTIVE=false`

## Node types

| Type | Role | Public surface |
| --- | --- | --- |
| VALIDATOR | Consensus voting, WAL, signer safety | none |
| SENTRY | Shield validators from public peers | private P2P / validator RPC |
| RPC | Versioned public/read API | PUBLIC_RPC `/v1/*` only |
| EXPLORER_BACKEND | Rebuildable projection | GET `/v1/*` |
| MONITORING | Metrics / logs | scrape only; no secrets |

A validator must not host public RPC, Explorer, faucet, customer API,
Exchange matching, or custody signing.

## Consensus

SunRey BFT is a Tendermint-class development engine:

- bonded identifiable validators
- `f < 1/3` Byzantine voting power
- lock / valid-value / NIL / round-change
- finality after `> 2/3` PRECOMMIT and a `CommitCertificate`

Do not treat a local `produce-block` as network finality.

## Finality

Application layers use:

- `PENDING` — in mempool
- `INCLUDED` — observed in a local block
- `FINALIZED` — commit certificate present
- `FAILED` — rejected

Local height is not finality.

## Validator lifecycle

Operator states:

1. `REGISTERED`
2. `PENDING_ACTIVATION`
3. `ACTIVE`
4. `SUSPENDED`
5. `EXITING`
6. `INACTIVE`

Mainnet activation requires an explicit human governance process.
AI cannot control a validator, rotate keys, or vote.

Protocol statuses (Candidate / Bonded / Jailed / …) remain the
authoritative machine states. Operator states are a mapping.

## RPC

| Plane | Bind | Methods |
| --- | --- | --- |
| PUBLIC_RPC | public edge | status, blocks, tx read/submit, accounts, assets, fees, validators |
| VALIDATOR_RPC | private | validator status, peers, WAL |
| ADMIN_RPC | loopback / admin network | produce-block and operator tools |

Public RPC is rate-limited, size-capped, allowlisted, and emits
`X-Request-Id`. It never exposes signing or `/admin/*`.

## Key handling

Keep four roles distinct:

- validator consensus key
- wallet / user keys
- node (P2P) identity
- administrative keys

Store production material in HSM/KMS references. Never commit
private keys. Rotation is a queued protocol change, not a file
overwrite of a live consensus key.

Signer safety persists the last signed `(height, round, step)`.
Restart must not double-sign.

## Genesis

Use `sunrey-genesis` / `generate_genesis` for LOCAL, DEVNET, and
TESTNET. Outputs are hashable and marked `environment=simulation`.

MAINNET genesis fails closed until required governance fields are
supplied by humans. Fixtures cannot satisfy that path.

## Deployment

TESTNET is the active deployable network.

```
deploy/sunrey-testnet/k8s/validators.yaml
deploy/sunrey-testnet/k8s/sentry.yaml
deploy/sunrey-testnet/k8s/seed-rpc.yaml
deploy/sunrey-testnet/k8s/faucet-explorer.yaml
deploy/sunrey-testnet/k8s/monitoring.yaml
```

Production-candidate modules live under `infra/sunrey-production`.
They do not deploy live mainnet.

## Recovery

1. Stop signing (maintenance / fence).
2. Take or locate a snapshot; verify the manifest hash.
3. Restore only onto the matching network/chain ID.
4. Replay WAL; confirm signer high-watermark.
5. Rejoin sentries; do not gossip from an unverified snapshot.

Application rollback is not chain-history rollback.

## Mainnet blockers

- governance-approved genesis fields
- production key ceremony
- counsel-confirmed economics
- `production_network_enabled` remains false
- development BFT is not a production certification

Operate TESTNET. Do not enable mainnet.
