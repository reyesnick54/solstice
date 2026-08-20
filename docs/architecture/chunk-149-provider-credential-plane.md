# Chunk 149 — Production Provider Credential Plane

The credential plane answers one question:

> Which short-lived, workload-bound reference may a simulation adapter
> use to talk to a named provider domain — without ever treating that
> reference as plaintext, approval, or SunRey authority?

It does **not** contact real providers. It does **not** enable
`PRODUCTION_AUTHORIZED`. It does **not** issue Execution Authority,
post a ledger journal, or mint.

Canonical owner: `packages/security/src/regulated/credentials`.

Provider acceptance remains `packages/sunrey-chain/src/providers`.
Provider runtime remains `packages/sunrey-chain/src/provider-runtime`.

Do not create `packages/secrets`, `packages/credentials`,
`packages/provider-security`, `packages/provider-runtime-v2`,
`packages/external-connectivity`, or `packages/vendor-runtime`.

## Architecture

```
Provider Configuration
        ↓
SecretReference  (secret://<provider>/<path>)
        ↓
Workload-Bound Credential Binding
        ↓
Secret Provider / Key Provider / HSM handle
        ↓
Short-Lived Provider Session
        ↓
Domain Adapter
        ↓
Sandbox / Integration-Test Transport
```

Raw credentials never enter domain configuration.

## Isolation

A credential assigned to `oracle_collector` cannot be used by
`banking_worker` or `custody_worker`.

A credential bound to `IDENTITY_KYC` cannot be reused automatically
for `CUSTODY_PROVIDER`, `SANCTIONS_PEP`, `BANKING_REFERENCE`, or
`ORACLE_DATA_SOURCE`. Replacement of provider A by provider B creates
a new descriptor, a new binding, and a new evidence state.

Operations are enumerated. Wildcard authority is not the default.

## Lifecycle

`ACTIVE → ROTATING → RETIRED`, or `ACTIVE → REVOKED`.

Webhook verification may accept the previous signing secret only
during a bounded overlap. Expired, revoked, retired, not-yet-valid,
and scope-mismatched credentials fail closed.

## Authority

A provider credential grants access to an external service boundary.
It does not grant:

- SunRey Execution Authority
- ledger posting authority
- monetary issuance authority
- governance authority
- custody human approval authority

Configured, resolved, authenticated, and healthy are not provider
approval. External evidence and human acceptance remain required.

## Current environment

`ENVIRONMENT=simulation`. Every `LIVE_*` flag remains false. No code
path may enter `PRODUCTION_AUTHORIZED`.
