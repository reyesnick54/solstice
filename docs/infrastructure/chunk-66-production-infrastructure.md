# Chunk 66 — SunRey production infrastructure and secret controls

This chunk implements the provider-neutral production-infrastructure
control plane required before any future SunRey production deployment.
It does **not** launch mainnet, enable `LIVE_*` services, or convert
software evidence into legal, regulatory, or commercial-HSM approval.

Owner: `packages/sunrey-chain/src/infra`.
Capability: `sunrey-production-infrastructure`.

## What exists

- Chunk 61–65 readiness evidence reconciliation with exact artifact
  digests (formal report, audit preparation bundle, RC qualification,
  root-of-trust rehearsal transcript, SBOM, provenance)
- `ProductionInfrastructureProvider` and `ProductionInfrastructureRegistry`
- Workload identities for validator, sentry, RPC, Explorer, Exchange,
  custody, oracle collector, relayer, monitoring, backup, and release
- Classified secrets over canonical `SecretReference` / `SecretProvider`
- KMS and HSM adapters over the Chunk 64 `HsmKmsProvider` contract
- Network zones, default-deny paths, and documented egress classes
- TLS/DNS/container-registry/object-storage interfaces
- Provider-neutral OpenTofu-style modules and Helm manifests
- Local CI harness with test-only credentials

## What this is not

- Not a production network launch
- Not a commercial cloud deployment
- Not a second security, ledger, readiness, custody, or Exchange system
- Not a claim that an independent audit, commercial HSM, or counsel
  opinion exists
- Not mainnet activation

`PRODUCTION_CANDIDATE` is a configuration layer. It does not imply
active mainnet.
