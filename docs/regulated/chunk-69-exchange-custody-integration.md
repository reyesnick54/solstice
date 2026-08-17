# Chunk 69 — SunRey Exchange and custody production-candidate integration

This chunk adds provider-neutral adapters that connect the existing
SunRey Exchange, institutional custody, Compliance Kernel, security,
and Chunk 65 readiness controls to regulated-service dependencies.

It does **not** create a second Exchange, custody system, Compliance
Kernel, or native-asset ledger. It does **not** activate live
regulated services. `ENVIRONMENT` remains `simulation`. All `LIVE_*`
flags remain false.

## What is implemented

- `RegulatedServiceProviderRegistry` and explicit activation modes
- KYC, screening, Travel Rule, HSM/custody, surveillance, and
  case-management ports
- Production-candidate withdrawal gate and destination binding
- Customer asset segregation verification and reconciliation incidents
- Market access, listing governance, kill switches, and HIR privacy
- Chunk 65 activation-matrix feed for Exchange, custody, HIR, and
  productive-capacity capabilities
- Deterministic sandbox providers for CI

## Activation modes

`SIMULATION`, `SANDBOX`, `INTEGRATION_TEST`, and
`PRODUCTION_CANDIDATE_DISABLED`.

There is no generic mode that silently activates live financial
execution.

## Kernel boundary

External providers generate facts. They do not replace the Compliance
Kernel. The Kernel remains the deterministic policy and authority
layer. A KYC provider cannot issue Execution Authority.

## Readiness

`RegulatedMarketReadinessReport` separates technical, security,
operations, provider, legal, license, and human-authorization
evidence. Missing evidence stays visible. Unlicensed activation
remains incomplete.

See also:

- [provider-registry.md](./provider-registry.md)
- [market-access.md](./market-access.md)
- [custody-activation.md](./custody-activation.md)
- [travel-rule.md](./travel-rule.md)
- [market-surveillance.md](./market-surveillance.md)
