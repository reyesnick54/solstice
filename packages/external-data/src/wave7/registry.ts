/**
 * Wave 7 — authoritative implemented-provider registry across Waves 2–5.
 */

import { WAVE2_IMPLEMENTED_PROVIDER_IDS } from '../adapters.ts';
import { WAVE4_BLOCKED_PROVIDER_IDS, WAVE4_DEPRECATED_PROVIDER_IDS, WAVE4_IMPLEMENTED_PROVIDER_IDS } from '../wave4/catalog-entries.ts';
import { FX_REFERENCE_CATALOG_ENTRIES } from '../../../payments/src/fx-reference/catalog-entries.ts';
import { CRYPTO_MARKET_CATALOG_PROVIDER_IDS } from '../../../sunrey-exchange/src/crypto-market/catalog-entries.ts';
import { CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS } from '../../../sunrey-chain/src/chain-intelligence/catalog-entries.ts';
import { ENVIRONMENTAL_CATALOG_PROVIDER_IDS } from '../../../sunrey-chain/src/environmental/catalog-entries.ts';
import { WAVE5_ADAPTER_IDS, WAVE5_BLOCKED_PROVIDER_IDS } from '../../../sunrey-chain/src/productive-economy-providers/catalog-entries.ts';

/** Compliance intelligence providers (also in kernel catalog; listed here to avoid kernel import). */
const COMPLIANCE_INTELLIGENCE_PROVIDER_IDS = ['open-sanctions', 'interpol-red-notices'] as const;

export const WAVE7_IMPLEMENTED_ACTIVE_IDS = Object.freeze(
  new Set<string>([
    ...WAVE2_IMPLEMENTED_PROVIDER_IDS,
    ...FX_REFERENCE_CATALOG_ENTRIES.map((e) => String(e.provider_id)),
    ...CRYPTO_MARKET_CATALOG_PROVIDER_IDS,
    ...CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS,
    ...WAVE4_IMPLEMENTED_PROVIDER_IDS,
    ...COMPLIANCE_INTELLIGENCE_PROVIDER_IDS,
    ...WAVE5_ADAPTER_IDS,
    ...ENVIRONMENTAL_CATALOG_PROVIDER_IDS,
  ]),
);

export const WAVE7_PREVIEW_ONLY_IDS = Object.freeze(
  new Set<string>([
    // Environmental and productive providers run simulation fixtures — preview tier.
    ...ENVIRONMENTAL_CATALOG_PROVIDER_IDS,
    ...WAVE5_ADAPTER_IDS,
  ]),
);

export const WAVE7_BLOCKED_IDS = Object.freeze(
  new Set<string>([
    'yahoo-finance-unofficial',
    'quandl-nasdaq-data-link',
    'currencyapi-com',
    'world-check-refinitiv',
    'dow-jones-risk',
    'lexisnexis-bridger',
    ...WAVE4_BLOCKED_PROVIDER_IDS,
    ...WAVE5_BLOCKED_PROVIDER_IDS,
  ]),
);

export const WAVE7_DEPRECATED_IDS = Object.freeze(
  new Set<string>(['treasury-direct-legacy-xml', 'pep-wikidata-legacy', ...WAVE4_DEPRECATED_PROVIDER_IDS]),
);

export const WAVE7_NOT_FREE_IDS = Object.freeze(
  new Set<string>(['world-check-refinitiv', 'dow-jones-risk', 'lexisnexis-bridger']),
);

export const WAVE7_LEGAL_REVIEW_IDS = Object.freeze(
  new Set<string>(['yahoo-finance-unofficial', 'quandl-nasdaq-data-link', 'currencyapi-com', 'tilth']),
);

export const WAVE7_ADAPTER_BY_PROVIDER: Readonly<Record<string, string>> = Object.freeze({
  fred: 'packages/external-data/src/adapters.ts',
  'open-sanctions': 'packages/external-data/src/wave4/adapters.ts',
  'open-meteo': 'packages/sunrey-chain/src/environmental/adapters/index.ts',
  coingecko: 'packages/sunrey-exchange/src/crypto-market/adapters/index.ts',
  'national-grid-eso': 'packages/sunrey-chain/src/productive-economy-providers/adapters/base.ts',
});

export const WAVE7_CANONICAL_SERVICE_BY_CATEGORY: Readonly<Record<string, string>> = Object.freeze({
  macroeconomics: 'ExternalDataPlane.macro',
  foreign_exchange: 'FxReferenceService',
  markets: 'MarketReferenceService',
  securities: 'MarketReferenceService',
  commodities: 'ExternalDataPlane.commodities',
  corporate_filings: 'ExternalDataPlane.filings',
  government_open_data: 'ExternalDataPlane.regulatory',
  cryptocurrency: 'CryptoMarketService',
  blockchain: 'ChainIntelligenceService',
  compliance: 'ComplianceIntelligenceService',
  kyb_identity: 'ExternalDataPlane.businessIdentity',
  fraud_risk: 'ExternalDataPlane.digitalRisk',
  cybersecurity: 'ExternalDataPlane.vulnerability',
  energy: 'ProductiveEconomyService',
  environmental: 'EnvironmentalOracleService',
  weather: 'EnvironmentalOracleService',
  food_nutrition: 'ProductiveEconomyService',
  natural_resources: 'ProductiveEconomyService',
  water: 'EnvironmentalOracleService',
});
