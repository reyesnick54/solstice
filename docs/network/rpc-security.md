# Public RPC security

## Zone isolation

`PUBLIC_RPC` cannot reach `SIGNER_PRIVATE`, `VALIDATOR_PRIVATE`, or
`CUSTODY_PRIVATE`. Those paths are forbidden in the Chunk 66 network
policy.

## Anti-abuse

`RpcAbuseProtection` bounds:

- request floods
- oversized payloads (default 16 KiB)
- invalid transaction floods
- subscription exhaustion
- expensive query abuse
- connection exhaustion

Forbidden public methods include validator admin, signer, custody
signing, and governance-key operations.

## TLS and HTTP edge

Production edge configuration includes:

- TLS required outside local devnet
- security headers (`strict-transport-security`, `x-content-type-options`,
  `x-frame-options`, `referrer-policy`, `content-security-policy`)
- request-size constraints
- trusted-proxy hop limits
- same-site or allowlist origin policy

## DDoS provider port

`EdgeProtectionPort` is vendor-neutral. Protocol behavior is not
coupled to a specific CDN or DDoS vendor. A configured generic
provider may sit in front of the public edge.

## API keys

Optional developer API keys raise quotas only. They do not grant
financial authority and cannot authorize custody or Exchange actions.

Anonymous access is a configurable low-quota path.

## Privacy

The public edge never serves PDV source data, KYC records, provider
credentials, private case information, custody private metadata, or
restricted security evidence. Cache stores only deterministic public
reads.
