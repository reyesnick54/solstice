# Validator node operations

A SunRey validator is a high-security trust zone. Operate it behind
at least two sentry nodes and a remote signer.

## Deployment profile

Required configuration:

- network ID and chain ID
- data directory
- private P2P listen address
- at least two persistent sentry peers
- authenticated signer endpoint (UDS or mTLS)
- local or private-network RPC
- state-sync and snapshot directories
- metrics endpoint
- structured JSON logs
- resource limits

Unsafe combinations are rejected. The validator must not host a
public web UI, Explorer, faucet, customer API, exchange matching, or
custody operations.

## Commands

```
sunrey-ops validator status
sunrey-ops validator peers
sunrey-ops validator keys
sunrey-ops validator key-generate
sunrey-ops validator join
sunrey-ops validator rotate
sunrey-ops validator exit
sunrey-ops validator evidence
```

## Restart

Restart preserves the consensus WAL, signer-safety high watermark,
and finalized state. A restart must not trigger a duplicate vote.

## Maintenance

Enter maintenance mode before disk recovery or binary replacement.
Readiness and status remain available. Signing is refused until the
node leaves maintenance.
