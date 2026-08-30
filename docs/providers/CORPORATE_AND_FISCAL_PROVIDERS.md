# Corporate and Fiscal External Providers (Wave 2)

## Scope

Wave 2 Prompt 11 completes the economics / markets / FX external-data plane with:

- Corporate filings and financial disclosures (SEC EDGAR)
- Treasury / fiscal datasets (US Treasury Fiscal Data, FRED treasury yields)
- Regulatory economic publications (Federal Register)
- Macro, FX, market, and commodity reference providers from Prompts 8–10

All integrations use Wave 1 infrastructure (`packages/provider-sdk`, provider runtime data-delivery, observability).

## Canonical owner

| Concern | Owner |
| --- | --- |
| Domain models & services | `packages/external-data` |
| Provider SDK / observations | `packages/provider-sdk` |
| Cache / SWR | `packages/sunrey-chain/src/provider-runtime/data-delivery` |
| Provider health | `packages/sunrey-chain/src/provider-runtime/universal/observability` |
| Consumer BFF | `services/api/src/consumer/world-external-data-adapter.ts` |

## Implemented providers (simulation fixtures)

| Provider | Category | Interface |
| --- | --- | --- |
| `fred` | macroeconomics | `MacroDataService` |
| `world-bank` | macroeconomics | `MacroDataService` |
| `bls` | macroeconomics | `MacroDataService` |
| `imf-data` | macroeconomics | `MacroDataService` |
| `frankfurter` | foreign_exchange | `FxReferenceService` |
| `exchangerate-host` | foreign_exchange | `FxReferenceService` |
| `alpha-vantage` | markets | `MarketReferenceService` |
| `finnhub` | markets | `MarketReferenceService` |
| `fred-commodity` | commodities | `MarketReferenceService` |
| `sec-edgar` | corporate_filings | `CompanyIntelligenceService` |
| `us-treasury-fiscal` | government_open_data | `MacroDataService` |
| `federal-register` | government_open_data | `CompanyIntelligenceService` |

## Domain models

- `CompanyFiling`, `FilingDocument`, `FinancialDisclosure`
- `CompanyIdentifier` (CIK, ticker, legal name — no name-only entity matching)
- `MacroIndicator`, `FxReferenceRate`, `MarketQuote`, `CommodityReference`
- `TreasuryYield`, `FiscalBalance`, `RegulatoryPublication`

Full document archives are **not** copied into SunRey storage. Metadata, normalized observations, provider URLs, and provenance are retained.

## BFF resources

| Path | Description |
| --- | --- |
| `GET /api/v1/world/economy` | Macro + treasury + fiscal snapshot |
| `GET /api/v1/world/fx` | FX reference rates |
| `GET /api/v1/world/markets` | Market quotes + commodities |
| `GET /api/v1/world/filings` | Company filing metadata |
| `GET /api/v1/world/regulatory` | Regulatory publications (research evidence only) |

No credentials pass through the BFF. No user-controlled provider URLs.

## Cache policies

| Capability | Fresh TTL | SWR | Hard expire |
| --- | --- | --- | --- |
| `fx_rates` | 5 min | 30 min | 24 h |
| `market_prices` | 1 min | 15 min | 4 h |
| `macroeconomic_indicators` | 1 h | 24 h | 7 d |
| `company_filings` | 1 h | 24 h | 30 d |
| `fiscal_data` | 6 h | 48 h | 14 d |

See `packages/sunrey-chain/src/provider-runtime/data-delivery/policies.ts`.

## Authority

External providers supply **reference observations only**. They do not issue Execution Authority, approve trades, or interpret regulations as compliance rules.
