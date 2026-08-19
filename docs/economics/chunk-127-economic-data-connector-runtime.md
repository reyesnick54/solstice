# Chunk 127 — Production Economic Data Connector Runtime

Canonical owner: `packages/sunrey-chain`.

Capability `sunrey-economic-data-connector-runtime` is `IMPLEMENTED`
at `packages/sunrey-chain/src/oracle/production`. It extends the
Chunk 68 production-oracle owner. It does not create a second oracle
network, a second consensus, or a live named-provider integration.

This chunk begins the real-world data integration program by adding
the **safe off-chain connector runtime** required before any named
provider is connected.

## Why this exists

Chunk 68 already defines provider-neutral authentication adapters:

- `MtlsSourceAdapter`
- `ApiKeyReferenceAdapter`
- `OauthClientAdapter`
- `SignedRequestAdapter`
- `PrivateNetworkAdapter`

Those V1 adapters authenticate against `SecretProvider` and then
return "interface only; live provider endpoints are not contacted."
That is correct for simulation. It is not a transport.

Real network I/O is asynchronous. This chunk introduces
`OracleSourceAdapterV2` with:

`retrieve(request, context): Promise<Result<ExternalSourceRecord, ...>>`

V1 adapters remain for compatibility and stay interface-only / legacy
simulation.

## Constitutional firewall

Consensus, validator state transition, block execution, and MoonRey
issuance verification never call HTTP, web APIs, external databases,
or vendor SDKs.

The only legal data flow is:

External Provider
→ Off-Chain Connector Runtime
→ Schema Validation
→ Provenance
→ Signed Oracle Observation
→ Oracle Consensus
→ Verified Economic Fact

A successful fetch is not a verified fact and is not MoonRey:

`HTTP_FETCH_SUCCESS`
≠ `VERIFIED_ECONOMIC_FACT`
≠ `PRODUCTIVE_CONTRIBUTION`
≠ `PRODUCTIVE_VALUE`
≠ `MOONREY_ISSUANCE`

## Connectivity modes

Modes are explicit. There is no `production=true` boolean.

| Mode | Default | Public internet |
| --- | --- | --- |
| `FIXTURE` | CI default | forbidden |
| `SANDBOX` | local sandbox | forbidden |
| `TESTNET_EXTERNAL` | opt-in | requires `externalNetworkEnabled` |
| `PRODUCTION_CANDIDATE_EXTERNAL` | DISABLED / UNCONFIGURED | requires explicit configuration |

Mainnet connectivity is `DISABLED` or `UNCONFIGURED`.

## Security

- `ProviderEndpointProfile` allowlists scheme, host, port, path,
  methods, TLS, size, timeout, redirects, and network class.
- Arbitrary user-supplied URLs are refused.
- SSRF fails closed for localhost, loopback, link-local, cloud
  metadata, and private networks unless the adapter is
  `PRIVATE_NETWORK` with an approved profile.
- Redirects are bounded and re-validated after every hop.
- Public internet providers require HTTPS and certificate
  verification. `rejectUnauthorized=false` is forbidden.
- Credentials remain behind `SecretProvider` / `SecretReference`.
  They never appear in logs, exceptions, metrics, provenance,
  observations, or the Economic Asset Registry.

## Authentication

Transport-level implementations:

- `API_KEY_REFERENCE`
- `OAUTH_CLIENT` (client-credentials, token expiry, re-acquisition)
- `SIGNED_REQUEST` (`HMAC-SHA256` only; registered crypto)
- `MTLS` (certificate and key references)
- `PRIVATE_NETWORK`

OAuth access tokens are never logged. Tests use a fake transport.

## Operational controls

Bounded retries apply only to timeouts, 429, and selected 5xx.
Authentication, schema, license/policy, and semantic 4xx failures
do not retry.

Per-source rate limits support interval, burst, cooldown, and
`Retry-After`. Circuit breaker states are `CLOSED`, `OPEN`, and
`HALF_OPEN`. They are operational state only.

Responses are bounded by timeout, maximum bytes, allowed content
types (`application/json` only), and existing feed schema limits.

## Provenance

Accepted fetches produce privacy-safe `SourceProvenance` and a
`CanonicalCollectedObservation` draft. Collection time and source
observation time are distinct. Content hashes cover canonical
validated source JSON, not ephemeral HTTP headers.

Existing signing, provider registration, oracle submission, quorum,
and finality still apply. This runtime does not submit to consensus.

## Demo

`demo:sunrey-oracle-connector-runtime` uses a deterministic local
sandbox transport and prints:

```
CONSENSUS_CALLED_HTTP=false
LIVE_MAINNET_CONNECTIVITY=false
CREDENTIALS_EXPOSED=false
FETCH_AUTO_FINALIZED_ORACLE=false
FETCH_AUTO_MINTED_MOONREY=false
```

Do not create `packages/oracle-connectors`,
`packages/data-ingestion`, `packages/moonrey-connectors`, or
`packages/provider-runtime-v2`.
