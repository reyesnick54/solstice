# Chunk 68 — production-candidate oracle data plane

Owner: `packages/sunrey-chain/src/oracle/production`.

This is the production-candidate onboarding and collection layer for
MoonRey and other verified economic facts. It extends Chunk 43. It is
not a second consensus system and not a live data-provider network.

## Status language

| State | Meaning |
| --- | --- |
| Technical implementation | Collector, adapters, schema, signing, and provenance exist |
| Provider configured | A simulation or testnet provider record is present |
| Provider agreement evidence | A commercial/data-license reference was supplied and confirmed |
| Production eligible | Status is `PRODUCTION_CANDIDATE` and required evidence is configured |

Missing contracts are never represented as confirmed.

## Invariants

- Consensus never calls external APIs
- External collection remains off-chain
- Consensus-facing values are integers / fixed-point
- Oracle fact creation never mints MoonRey
- AI cannot restore a suspended production provider
- Historical observations remain verifiable after key rotation
- Schema drift is an explicit incompatibility

See also:

- [provider-onboarding.md](./provider-onboarding.md)
- [source-provenance.md](./source-provenance.md)
- [source-independence.md](./source-independence.md)
- [production-eligibility.md](./production-eligibility.md)
