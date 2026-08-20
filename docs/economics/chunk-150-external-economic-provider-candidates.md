# Chunk 150 — External Economic Oracle Provider Production-Candidate Layer

This chunk is the last provider-neutral layer needed to onboard real
economic-data providers later **without changing oracle architecture**.

It is not another oracle consensus engine.
It is not another connector runtime.
It is not another provider-certification owner.
It is not another Economic Data Fabric.
It is not a mint.

## Architecture

```
Future Real Provider
        ↓
Provider Candidate Profile
        ↓
Credential Binding (Chunk 149 descriptor refs)
        ↓
Approved Endpoint Blueprint
        ↓
Injected Transport (fake in this chunk)
        ↓
Provider-Specific Response Translator
        ↓
Canonical Source Record
        ↓
Existing Connector Runtime (Chunk 127)
        ↓
Certification (Chunk 128)
        ↓
Economic Data Fabric (Chunk 138)
        ↓
Oracle Observation
        ↓
Existing Oracle Consensus
```

This chunk **stops before a real network request**.

## Owner

`packages/sunrey-chain/src/oracle/production/external-provider-candidate`

Extends:

- `sunrey-production-oracles`
- `sunrey-provider-certification`
- `sunrey-economic-data-connector-runtime`

Do not create `packages/external-oracle-providers`,
`packages/oracle-provider-candidates`,
`packages/external-economic-oracles`, or a second oracle capability.

Generic provider runtime (Chunk 91) still owns sessions, workload
identities, generic credential bindings, health, and mock transport.
This layer owns economic-data semantics, feed profiles, vendor
normalization, source relationships, and oracle onboarding.

## Constitutional firewall

| Flag | Value |
| --- | --- |
| `REAL_EXTERNAL_PROVIDER_CONFIGURED` | `false` |
| `REAL_NETWORK_CALLED` | `false` |
| `CONSENSUS_CALLS_HTTP` | `false` |
| `RAW_CREDENTIALS_PRESENT` | `false` |
| `REFERENCE_PRICE_MINTS` | `false` |
| `PROVIDER_SUCCESS_MINTS` | `false` |
| `PRODUCTION_ACTIVE` | `false` |

A populated contract string such as `contract-123` is
`REFERENCE_RECORDED`, not `CONFIRMED`. Presence is not proof.

## Profiles

`ExternalEconomicOracleProviderCandidateProfile` binds provider identity,
controller / upstream / shared-control, feed profiles, credential
descriptor refs, and endpoint profile IDs.

States: `DRAFT`, `ENGINEERING_SANDBOX`, `CONFORMANCE_PASSED`,
`EXTERNAL_EVIDENCE_REQUIRED`, `PRODUCTION_CANDIDATE_DISABLED`,
`SUSPENDED`, `REVOKED`.

`productionAuthorized` is always `false`.

Suspended or revoked profiles cannot generate admissible new observation
drafts. Historical finalized facts remain historical.

## Endpoints and requests

Runtime requests reference `endpointProfileId`, never an arbitrary
caller-supplied URL. The Chunk 127 SSRF firewall is reused.

Rejected destinations include localhost, link-local, metadata services,
IP-literal bypass, credentials in the URL, and redirects off the
approved origin.

Request blueprints never store `Authorization` values, API keys, OAuth
tokens, or private certificate material.

## Authentication

Supported classes remain the existing oracle methods: `MTLS`,
`API_KEY_REFERENCE`, `OAUTH_CLIENT`, `SIGNED_REQUEST`, `PRIVATE_NETWORK`.

Credentials bind to Chunk 149 descriptor references. Resolution happens
only inside an adapter/transport boundary. OAuth tokens are modeled as
injected-transport handles and must not persist in source records,
provenance, logs, the Economic Asset Registry, or oracle observations.

## Translation, units, and time

Vendor DTOs terminate in `ExternalProviderResponseTranslator`. Outputs
are existing canonical types only (`ExternalSourceRecord`,
`CanonicalCollectedObservation`, `CanonicalProductiveMeasurement`).

Every translator is bound to provider schema ID/version, SunRey
canonical schema ID, and mapping version. Field removal, type change,
unit change, or timestamp-semantics change triggers `SCHEMA_DRIFT` /
`REVALIDATION_REQUIRED`.

Unsupported units are `UNIT_EXTENSION_REQUIRED`. Conversions are not
invented. Collection time is never fabricated as source event time.

## Routing and reference prices

Every candidate feed routes into an existing provider family. No new
productive taxonomy.

`REFERENCE_PRICE` remains reference-only. A market-price provider does
not create productive output, Productive Value, or MoonRey.

## Pagination and rate limits

Modes: `NONE`, `CURSOR`, `PAGE_NUMBER`, `TIME_WINDOW`. Pages and
records/page are bounded. Cursor loops are rejected. A failed page N
retains already-validated drafts and does not fabricate the missing
page or create quorum.

Rate limits, retry-after, and circuit breakers reuse the existing
connector machinery. Authentication failures are never retried blindly.

## Isolation

Consensus cannot import external transport, HTTP clients, credential
resolvers, secret providers, or endpoint profiles. It consumes only
canonical observations.

Provider success cannot call Productive Value, MoonRey conversion,
`MonetaryIssuanceAuthority`, or `AssetSupplyBook` mutation.

The Economic Asset Registry receives only safe metadata: provider/source
descriptors, feed descriptors, schema commitments, and observation-set
commitments.

## Fixture providers

Injected fake transports only. No real domains.

- `fixture-energy-mtls`
- `fixture-compute-oauth`
- `fixture-manufacturing-api-key`
- `fixture-logistics-signed-request`

## Demo

`demo:sunrey-external-oracle-provider-candidates`

Prints:

```
REAL_EXTERNAL_PROVIDER_CONFIGURED=false
REAL_NETWORK_CALLED=false
CONSENSUS_CALLS_HTTP=false
RAW_CREDENTIALS_PRESENT=false
REFERENCE_PRICE_MINTS=false
PROVIDER_SUCCESS_MINTS=false
PRODUCTION_ACTIVE=false
```
