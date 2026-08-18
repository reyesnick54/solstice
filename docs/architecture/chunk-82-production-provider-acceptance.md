# Chunk 82 — Production provider acceptance

Owner: `packages/sunrey-chain/src/providers`.

Capability `sunrey-production-provider-acceptance` is `IMPLEMENTED`.

This chunk is the engineering system for later onboarding of real
external providers. It reuses:

- Chunk 66 `ProductionInfrastructureRegistry`
- Chunk 68 oracle onboarding registry
- Chunk 69 `RegulatedServiceProviderRegistry`
- Chunk 64 / `packages/security` HSM/KMS port
- Chunk 65 mainnet readiness and genesis-candidate surfaces

It does not create a second provider registry. It does not fabricate
contracts, licenses, registrations, commercial HSM certification,
security approval, oracle data rights, banking agreements, or
regulatory approval.

AI cannot mark `HUMAN_ACCEPTED` or `PRODUCTION_ELIGIBLE`.

Do not create `packages/provider-acceptance`,
`packages/production-providers`, `packages/external-providers`,
or `packages/sunrey-providers`.
