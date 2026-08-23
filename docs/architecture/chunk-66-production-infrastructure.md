# Chunk 66 — SunRey production infrastructure

See [../infrastructure/chunk-66-production-infrastructure.md](../infrastructure/chunk-66-production-infrastructure.md).

Implemented at `packages/sunrey-chain/src/infra` (canonical
`packages/sunrey-chain/src/infra/provider.ts`). Capability
`sunrey-production-infrastructure` is `IMPLEMENTED`.

This is a provider-neutral control plane. Production mainnet remains
disabled. Do not create `packages/sunrey-infra`,
`packages/infrastructure`, `packages/production-infrastructure`,
`packages/cloud-adapters`, or `packages/sunrey-cloud`.

Phase I Prompt 4 extends this owner with the preproduction platform
at `packages/sunrey-chain/src/infra/preproduction` and the Helm chart
`infra/sunrey-production/helm/sunrey-preproduction`. PREPRODUCTION
resembles production topology. It does not authorize live customer
production.
