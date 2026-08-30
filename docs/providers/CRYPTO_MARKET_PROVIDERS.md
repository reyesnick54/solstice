# Crypto Market Reference Providers

Wave 3 / Prompt 12 — normalized cryptocurrency market-reference layer for SunRey.

## Status

| Item | Value |
| --- | --- |
| Catalog population | `partial` (crypto subset merged) |
| Crypto providers integrated | **6** |
| Production-enabled adapters | **5** (fixture-backed, simulation) |
| Blocked providers | **1** (`coinmarketcap`) |
| Environment | `simulation` only |
| Live provider connectivity | `false` |

## Canonical owner

`packages/sunrey-exchange/src/crypto-market/`

Extends the Exchange owner. Does **not** create a parallel market-data package,
ledger path, or execution authority.

## Providers integrated

| Provider ID | Launch tier | Priority | Auth | Status |
| --- | --- | --- | --- | --- |
| `coingecko` | production_candidate | primary | none | adapter implemented |
| `coincap` | secondary_source | secondary | none | adapter implemented |
| `coinpaprika` | secondary_source | secondary | none | adapter implemented |
| `cryptocompare` | secondary_source | secondary | API key | adapter implemented |
| `coinlore` | fallback_source | fallback | none | adapter implemented |
| `coinmarketcap` | blocked_pending_review | blocked | API key | blocked |

Providers **not** in the authoritative catalog (e.g. Messari, CoinLobster) were
not invented for this prompt.

## Provider capabilities

| Capability | Description |
| --- | --- |
| `crypto_prices` | Spot/reference quotes |
| `crypto_market_data` | Ticker and market context |
| `crypto_assets` | Asset metadata |
| `crypto_market_history` | OHLCV candles |
| `crypto_market_cap` | Market capitalization |
| `crypto_exchange_reference` | Venue-specific quotes |
| `crypto_metadata` | Asset descriptions and IDs |

## Asset ID mapping

Symbols alone are **not** globally unique. Canonical identity:

```
CRYPTO:{SYMBOL}:{network}:{contract|native}:{QUOTE_CURRENCY}
```

Examples:

| Asset ID | Symbol | Network | Type |
| --- | --- | --- | --- |
| `CRYPTO:BTC:bitcoin:native:USD` | BTC | bitcoin | native |
| `CRYPTO:ETH:ethereum:native:USD` | ETH | ethereum | native |
| `CRYPTO:USDT:ethereum:0xdac17f...:USD` | USDT | ethereum | stablecoin |

Each asset carries `providerIds` mapping to provider-native identifiers.

## SunRey / MoonRey native asset separation

`SUNREY_COIN` and `MOONREY_COIN` are native SunRey blockchain assets.

- Not mapped to Ethereum, Bitcoin, Solana, or any third-party chain
- No external provider IDs fabricated for them
- BFF returns `NATIVE_ASSET_FORBIDDEN` if requested as external crypto reference
- Internal identity remains authoritative

## Price-source classification

| Type | Meaning | Example |
| --- | --- | --- |
| `GLOBAL_AGGREGATE` | Aggregated across venues | CoinGecko BTC/USD |
| `EXCHANGE_SPECIFIC` | Venue-specific quote | CryptoCompare exchange price |

`BTC/USDT` is not treated as identical to `BTC/USD` without explicit conversion.

## Canonical quote model

`CryptoMarketReferenceQuote` fields include:

- `priceMinorUnits`, `quoteCurrency`, `priceScale` (decimal-safe)
- `marketCapMinorUnits`, supply fields, volume, change bps
- `marketTimestamp`, `retrievedAt`, `freshness`
- `providerId`, `providerAssetId`, `observationId`
- `provenance.priceSourceType`, `authority: REFERENCE_ONLY`

## Historical data

Supported intervals where provider fixtures support them:

- `1m`, `5m`, `15m`, `1h`, `4h`, `1d`

Source resolution is preserved; intervals not supported by a provider are rejected.

## Cache policies

| Capability | Fresh TTL | Notes |
| --- | ---: | --- |
| Spot quote | 30s | Short-lived for volatile assets |
| Market cap | 60s | Moderate refresh |
| Asset metadata | 24h | Slow-changing |
| History (intraday) | 5m | Candles |
| History (daily) | 1h | Daily candles |
| Global stats | 2m | World aggregate context |

## Rate limits

Catalog documents per-provider free-tier limits. Adapters use fixture transport
in simulation; production activation requires credential plane binding and
governance review.

## Authority classes

All integrated crypto providers use `reference_data` authority class. They do not
receive execution, settlement, custody, or issuance authority.

## Exchange integration

External crypto reference data is exposed as **context only** via
`integrations/exchange.ts`:

- `ExternalCryptoReferenceContext` for comparative charts and trend info
- `orderBookAuthoritative: true`
- `externalPriceUsedForExecution: false`

SunRey Exchange internal order book and market state remain authoritative.

## Portfolio integration

`integrations/portfolio.ts` provides `PortfolioEstimatedValuation` with:

- `valuationType: REFERENCE_ESTIMATE`
- `custodialBalance: false`, `settledValue: false`, `realizedPnl: false`

## Financial Agent boundary

Agent research consumes `AgentCryptoEvidence` with:

- `readOnly: true`, `tradeAuthorized: false`, `executionAuthority: false`
- `label: REFERENCE_NOT_EXECUTION`

Flow: Crypto Reference → Agent Research → Recommendation → Suitability →
Compliance → User Authorization → Authorized Execution.

## World integration

`integrations/world.ts` exposes `WorldCryptoMarketSnapshot` with:

- BTC price, major asset market caps, volume
- `officialEconomicStatistic: false`
- `authorityClass: reference_data`

## Consumer BFF routes

| Method | Path |
| --- | --- |
| GET | `/api/v1/markets/crypto` |
| GET | `/api/v1/markets/crypto/:assetId` |
| GET | `/api/v1/markets/crypto/:assetId/history` |

BFF responses include provider name, freshness, and source timestamp. They do
**not** expose credentials, internal rate-limit state, internal URLs, or raw
provider payloads.

## Anomaly safety

- Rejects price ≤ 0, negative market cap/volume, invalid timestamps
- Flags extreme price changes via `ProviderDataOutlier` events (does not silently
  suppress legitimate volatility)

## Provider precedence

Primary → secondary → fallback based on catalog priority, launch tier, health,
and capability support. No synthetic consensus pricing in this prompt.

## Related documentation

- `docs/providers/MARKET_REFERENCE_PROVIDERS.md` (Wave 2 securities/commodities)
- `docs/providers/FX_REFERENCE_PROVIDERS.md`
- `docs/providers/PROVIDER_SDK_ARCHITECTURE.md`
- `packages/sunrey-exchange/src/crypto-market/`

## Tests

`tests/wave-3-prompt-12-crypto-market.test.ts` — 30+ acceptance checks covering
adapters, normalization, identity, separation, BFF, and governance boundaries.
