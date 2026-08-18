# Chunk 91 — SunRey executable provider runtime

SunRey can execute provider-neutral integrations against local mocks,
sandboxes, and credential-injected external systems. An adapter that
works is not an approved provider.

Owner: `packages/sunrey-chain/src/provider-runtime`.
Capability: `sunrey-provider-runtime`.

This extends:

- Chunk 66 production infrastructure
- Chunk 68 production oracles
- Chunk 69 regulated integration
- Chunk 82 production provider acceptance
- Chunk 90 day-2 operations

It does **not** create a second provider registry, secret store, KMS,
HSM, oracle, compliance, custody, or banking ledger.

## What exists

- `ExecutableProviderAdapter` implementations for every canonical
  Chunk 82 domain
- `ProviderRuntime`, `ProviderConnectionProfile`,
  `ProviderCredentialBinding`, `ProviderSession`
- `ProviderHealthSnapshot`, `ProviderCapabilityProbe`,
  `ProviderIntegrationTest`, `ProviderIntegrationEvidence`
- `ProviderRuntimeRegistry` and `ProviderRuntimeReadinessReport`
- Local mock servers for healthy, timeout, auth failure, schema
  change, duplicate callback, outage, partial response, and rate limit
- `sunrey-ops provider runtime-test`

## What this is not

- Contract, license, legal, or commercial approval
- A claim that a sandbox success is production authorization
- Consensus coupling to any cloud provider
- A path for KYC vendors or banks to issue Execution Authority or
  create Ledger balances

## Commands

```
sunrey-ops provider runtime-test
sunrey-ops provider runtime-readiness
sunrey-ops provider runtime-matrix
```

The runtime-test command reports whether the run used
`LOCAL_SIMULATION`, `SANDBOX`, or `EXTERNAL_INTEGRATION_TEST`.
Without sandbox credentials, CI uses local mocks.

See [provider-runtime-modes.md](./provider-runtime-modes.md),
[provider-credentials.md](./provider-credentials.md),
[provider-webhook-security.md](./provider-webhook-security.md), and
[provider-failure-handling.md](./provider-failure-handling.md).
