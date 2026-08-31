# SunRey Final Provider Matrix

Wave 7 Prompt 27 — generated from catalog coverage classifier.

| Metric | Value |
| --- | ---: |
| Catalog providers | 73 |
| Expected program total | 126 |
| Accepted Wave 6 gaps | 53 |

| Provider | Category | Adapter | Status | Environment | Auth | Commercial Status | Canonical Service | Primary/Fallback | Cache Policy | Health | Trust Policy | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fred | macroeconomics | packages/external-data/src/adapters.ts | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | ExternalDataPlane.macro | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| world-bank | macroeconomics | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.macro | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| bls | macroeconomics | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | ExternalDataPlane.macro | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| imf-data | macroeconomics | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.macro | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| frankfurter | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| exchangerate-host | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| alpha-vantage | markets | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | restricted | MarketReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| finnhub | markets | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | restricted | MarketReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| sec-edgar | corporate_filings | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.filings | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| us-treasury-fiscal | government_open_data | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.regulatory | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| federal-register | government_open_data | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.regulatory | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| fred-commodity | commodities | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | yes | verified_allowed | ExternalDataPlane.commodities | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| yahoo-finance-unofficial | markets | — | LEGAL_REVIEW_REQUIRED | simulation | no | requires_legal_review | MarketReferenceService | fixture | SWR | health | trust | Commercial or licensing review required before production activation. |
| quandl-nasdaq-data-link | markets | — | LEGAL_REVIEW_REQUIRED | simulation | yes | requires_legal_review | MarketReferenceService | fixture | SWR | health | trust | Commercial or licensing review required before production activation. |
| treasury-direct-legacy-xml | government_open_data | — | DEPRECATED | simulation | no | unknown | ExternalDataPlane.regulatory | fixture | SWR | health | trust | Provider deprecated; use alternative. |
| bank-of-russia | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| national-bank-poland | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| currency-api | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| exchangerate-dev | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| economia-awesome | foreign_exchange | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| currencyapi-com | foreign_exchange | — | LEGAL_REVIEW_REQUIRED | simulation | yes | verified_allowed | FxReferenceService | fixture | SWR | health | trust | Commercial or licensing review required before production activation. |
| coingecko | cryptocurrency | packages/sunrey-exchange/src/crypto-market/adapters/index.ts | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | CryptoMarketService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| coincap | cryptocurrency | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | CryptoMarketService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| coinpaprika | cryptocurrency | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | CryptoMarketService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| coinlore | cryptocurrency | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | CryptoMarketService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| cryptocompare | cryptocurrency | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | restricted | CryptoMarketService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| coinmarketcap | cryptocurrency | fixture-adapter | IMPLEMENTED_BLOCKED | simulation | yes | restricted | CryptoMarketService | fixture | SWR | health | trust | Adapter or catalog entry exists; production activation blocked. |
| mempool-space | blockchain | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ChainIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| blockchain-com | blockchain | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ChainIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| blockscout | blockchain | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ChainIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| btcglobe | blockchain | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ChainIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| open-sanctions | compliance | packages/external-data/src/wave4/adapters.ts | IMPLEMENTED_BLOCKED | simulation | no | restricted | ComplianceIntelligenceService | fixture | SWR | health | trust | Adapter or catalog entry exists; production activation blocked. |
| nvd | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| urlhaus | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| world-check-refinitiv | compliance | — | NOT_FREE_ANYMORE | simulation | no | requires_legal_review | ComplianceIntelligenceService | fixture | SWR | health | trust | No verified free tier; commercial only. |
| un-sanctions | compliance | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ComplianceIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| eu-sanctions | compliance | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ComplianceIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| gleif-lei | kyb_identity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.businessIdentity | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| companies-house-uk | kyb_identity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | ExternalDataPlane.businessIdentity | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| opencorporates | kyb_identity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | ExternalDataPlane.businessIdentity | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| abuseipdb | fraud_risk | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | yes | verified_allowed | ExternalDataPlane.digitalRisk | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| ip-api | fraud_risk | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.digitalRisk | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| mozilla-http-observatory | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| mozilla-tls-observatory | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| phishstats | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| virushee | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| cloudflare-trace | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| outagedeck | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| downstatus | cybersecurity | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ExternalDataPlane.vulnerability | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| dow-jones-risk | compliance | — | NOT_FREE_ANYMORE | simulation | no | requires_legal_review | ComplianceIntelligenceService | fixture | SWR | health | trust | No verified free tier; commercial only. |
| lexisnexis-bridger | compliance | — | NOT_FREE_ANYMORE | simulation | no | verified_allowed | ComplianceIntelligenceService | fixture | SWR | health | trust | No verified free tier; commercial only. |
| pep-wikidata-legacy | compliance | — | DEPRECATED | simulation | no | verified_allowed | ComplianceIntelligenceService | fixture | SWR | health | trust | Provider deprecated; use alternative. |
| interpol-red-notices | compliance | fixture-adapter | IMPLEMENTED_ACTIVE | simulation | no | verified_allowed | ComplianceIntelligenceService | fixture | SWR | health | trust | Simulation adapter with fixture transport. |
| national-grid-eso | energy | packages/sunrey-chain/src/productive-economy-providers/adapters/base.ts | IMPLEMENTED_PREVIEW_ONLY | simulation | no | attribution_required | ProductiveEconomyService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| uk-carbon-intensity | energy | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | attribution_required | ProductiveEconomyService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| energi-data-service | energy | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | ProductiveEconomyService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| co2-offset | environmental | — | LEGAL_REVIEW_REQUIRED | simulation | yes | unclear | EnvironmentalOracleService | fixture | SWR | health | trust | Commercial or licensing review required before production activation. |
| website-carbon | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | attribution_required | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| indian-mandi-prices | food_nutrition | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | yes | verified_allowed | ProductiveEconomyService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| tilth | food_nutrition | — | LEGAL_REVIEW_REQUIRED | simulation | yes | requires_legal_review | ProductiveEconomyService | fixture | SWR | health | trust | Commercial or licensing review required before production activation. |
| open-meteo | weather | packages/sunrey-chain/src/environmental/adapters/index.ts | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| open-meteo-ensemble | weather | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| nws | weather | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| aviationweather-noaa | aviation | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | — | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| pirate-weather | weather | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | yes | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| met-norway | weather | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| meltema | weather | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| usgs-water | water | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| epa | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| kanari | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| usgs-earthquake | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| openaq | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | no | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
| purpleair | environmental | fixture-adapter | IMPLEMENTED_PREVIEW_ONLY | simulation | yes | verified_allowed | EnvironmentalOracleService | fixture | SWR | health | trust | Simulation adapter with fixture transport; preview tier only. |
