# Chunk 162 — Production Provider Binding Manifest

Capability `sunrey-production-provider-binding` is `IMPLEMENTED` at
`packages/sunrey-chain/src/providers/production-binding`.

Canonical owner: `packages/sunrey-chain`. This chunk extends Chunk 82
provider acceptance and Chunk 91 provider runtime. It does not create
`packages/integrations-v2`, `packages/vendor-connectivity`,
`packages/provider-manager`, or `packages/live-providers`.

## What this chunk answers

Which real-world provider **would** serve each production domain, using
which environment, endpoint profile, credential reference, contract
evidence, jurisdictions, data classes, failover provider, and
operational owner — without contacting that provider.

## What this chunk does not do

- It does not enable real network calls.
- It does not flip `LIVE_*` flags or `ENVIRONMENT`.
- It does not store raw secrets. Only `SecretReference`, credential
  descriptor IDs, and version metadata are admitted.
- It does not treat `sandbox=true` plus `productionEligible=true` as
  production satisfaction.
- It does not expose webhook/callback endpoints externally.
- It does not add a `LIVE` binding state.

`productionConnectivityEnabled` is always `false`. The readiness
report ends at `connectivityReadyForHumanReview`, not
`connectivityEnabled`.

## Environment separation

Bindings are classified as `SANDBOX`, `CERTIFICATION`, or
`PRODUCTION_CANDIDATE`. Sandbox credentials cannot satisfy a
production-candidate binding. Endpoint profiles distinguish sandbox,
certification, and production-candidate hosts. Connectivity stays
disabled in every class.

## Consumption

- External evidence references are resolved through a Chunk 160 port.
  Expired or revoked evidence invalidates production-candidate
  eligibility. This chunk does not own a second evidence registry.
- Operating-scope coverage is resolved through a Chunk 161 port. A
  binding is invalid when the referenced scope does not cover the
  requested jurisdiction, product domain, data class, and operation.
  This chunk does not duplicate the scope evaluator.
- Production-binding-candidate advancement still requires Chunk 82
  provider acceptance `productionEligible`. That is not live
  connectivity.

## Failover and concentration

A failover provider must independently satisfy credentials, external
evidence, operating scope, acceptance, and conformance. Backup
providers do not inherit primary approvals.

Binding-level concentration reuses Chunk 82 `measureConcentration` and
adds corporation, region, and credential-authority clustering. The
report never claims organizational independence without evidence.

## Demo

```
npm run demo:sunrey-production-provider-binding
```

Expected markers:

```
PROVIDER_BINDINGS_COMPLETE=true
RAW_SECRET_PRESENT=false
SANDBOX_CREDENTIAL_USED_FOR_PRODUCTION=false
OPERATING_SCOPE_CHECKED=true
EXTERNAL_EVIDENCE_CHECKED=true
FAILOVER_PROVIDER_INDEPENDENTLY_QUALIFIED=true
REAL_PROVIDER_CALLED=false
LIVE_CONNECTIVITY_ENABLED=false
PRODUCTION_ACTIVE=false
```
