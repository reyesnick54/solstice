# SunRey External Data Architecture

Wave 7 Prompt 27 — final external data plane architecture (simulation).

## Authority boundary

External data **informs**. SunRey policy **authorizes**. Canonical ledgers determine **financial state**.

External providers never receive decision authority over financial execution, customer balances, settlement, custody, compliance approval, blockchain consensus, SunRey Coin issuance, or MoonRey Coin issuance.

## Data flow

```
External Providers (126-program target)
        ↓
Catalog (config/providers/free-api-catalog.yaml)
        ↓
Provider SDK (packages/provider-sdk)
        ↓
Transport / Auth (SSRF guard, credential refs via Chunk 149)
        ↓
Reliability (retry, rate limit, circuit breaker, bulkhead)
        ↓
Adapter Validation (schema, size limits, untrusted JSON)
        ↓
ExternalObservation (packages/provider-sdk observation envelope)
        ↓
Provenance (hash-chained raw payload digest)
        ↓
Cache / Persistence (packages/sunrey-chain/provider-runtime/data-delivery)
        ↓
ProviderRiskMonitor (packages/external-data/wave4)
        ↓
ExternalDataTrustEngine (packages/external-data/wave7)
        ↓
Canonical Domain Services (macro, FX, markets, compliance, environmental, …)
        ↓
Consumer BFF (services/api)
        ↓
SunRey Product
```

## Wave ownership

| Wave | Scope | Owner packages |
| --- | --- | --- |
| Wave 1 | Runtime, transport, reliability, observability | `provider-sdk`, `sunrey-chain/provider-runtime` |
| Wave 2 | Macro, FX, markets, filings | `external-data`, `payments/fx-reference`, `sunrey-exchange/market-reference` |
| Wave 3 | Crypto, blockchain intelligence | `sunrey-exchange/crypto-market`, `sunrey-chain/chain-intelligence` |
| Wave 4 | Compliance, KYB, fraud, cyber | `external-data/wave4`, `kernel/compliance-intelligence` |
| Wave 5 | Energy, resources, environmental | `sunrey-chain/productive-economy-providers`, `sunrey-chain/environmental` |
| Wave 6 | HIN, health, jobs, research, travel, geo (catalog gaps) | Documented accepted gaps — not fabricated |
| Wave 7 | Hardening, coverage, trust, chaos regression | `external-data/wave7` |

## Simulation posture

- `ENVIRONMENT=simulation`
- All `LIVE_*` flags remain `false`
- Adapters use deterministic fixtures — no live HTTP in CI
- Production activation blocked pending legal review and credentials

## Related documentation

- `docs/providers/FINAL_PROVIDER_MATRIX.md`
- `docs/providers/PRODUCTION_READINESS_SCORECARD.md`
- `docs/providers/PROVIDER_SDK_ARCHITECTURE.md`
- `docs/providers/PROVIDER_RISK_MONITOR.md`
- `docs/runbooks/EXTERNAL_PROVIDER_INCIDENT.md`
