# Chunk 94 — SunRey developer platform

Official application registry, scoped API credentials, signed webhooks,
Testnet/sandbox tooling, and local developer environment.

Canonical owner: `packages/sunrey-sdk` at
`packages/sunrey-sdk/src/developer-platform`.

Capability `sunrey-developer-platform` is `IMPLEMENTED`.

This chunk extends Chunk 51 (`sunrey-developer-sdk`) and Chunk 53
(`sunrey-public-testnet`). It does not create a second chain, ledger,
Exchange, or EVM compatibility layer.

## Surfaces

- `DeveloperPortalApi` — application, credential, webhook, quota, sandbox
- `sunrey-dev` CLI
- Versioned OpenAPI `api/sunrey-developer-platform-v1.openapi.yaml`
- Versioned webhook schema `api/sunrey-webhooks-v1.json`

## Hard boundaries

- A developer API key cannot sign user funds.
- User financial authority remains with the user wallet, custody
  authorization, Execution Authority, and canonical policy systems.
- Creating a production developer application does not activate SunRey
  production financial capabilities.
- Testnet faucet assets remain testnet only.
- Sandbox identities cannot become production identities.
- Developer organization roles are not protocol-governance roles.
- Webhook destinations are SSRF-checked. Deliveries are signed with
  `sunrey-webhook-v1` (HMAC-SHA256).

Do not create `packages/sunrey-developer-platform`,
`packages/developer-portal`, `packages/app-registry`,
`packages/webhook-service`, or `packages/developer-platform-v2`.
