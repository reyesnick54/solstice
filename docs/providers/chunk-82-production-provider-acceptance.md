# Chunk 82 — SunRey production provider acceptance

Chunk 90 consumes this evidence matrix for provider renewal reminders
and regulated-capability eligibility. Expired evidence is reported.
There is no automatic renewal claim. See
[../mainnet/chunk-90-production-handoff.md](../mainnet/chunk-90-production-handoff.md).


SunRey has one evidence-driven acceptance framework for external
production dependencies. The framework technically validates local and
sandbox providers in CI and records the slots that real providers must
later fill.

## What this is

- An acceptance profile, evidence record, test harness, matrix, and
  readiness feed for every supported provider domain.
- Cross-domain references into canonical registries. Not a second
  registry.

## What this is not

- A contract, license, registration, or commercial HSM certificate.
- A claim that a configured provider is an approved provider.
- A legal residency conclusion.
- Activation of `LIVE_*` flags or fiat rails.

## Owner

`packages/sunrey-chain/src/providers`

Commands:

```
sunrey-ops provider list
sunrey-ops provider profile HSM
sunrey-ops provider test
sunrey-ops provider evidence
sunrey-ops provider verify
sunrey-ops provider readiness
sunrey-ops provider matrix
```
