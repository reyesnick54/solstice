/**
 * Wave 4 provider catalog entries.
 *
 * Only providers present in the authoritative Wave 0 catalog are listed here.
 * As of Wave 4 Prompt 16, zero free/public APIs are categorized as
 * kyb_identity, fraud_risk, or cybersecurity in the catalog.
 * sec-edgar (corporate_filings) is the sole eligible Wave 0 provider for
 * public corporate identity evidence.
 */

export const WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS = Object.freeze(['sec-edgar'] as const);

export type Wave4EligibleCatalogProviderId = (typeof WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS)[number];

export const WAVE4_FIXTURE_PROVIDER_IDS = Object.freeze([
  'fixture-identity',
  'fixture-aml',
] as const);

export const WAVE4_IMPLEMENTED_PROVIDER_IDS = Object.freeze([
  ...WAVE4_ELIGIBLE_CATALOG_PROVIDER_IDS,
  ...WAVE4_FIXTURE_PROVIDER_IDS,
] as const);

export const WAVE4_BLOCKED_CATEGORIES = Object.freeze([
  'kyb_identity',
  'fraud_risk',
  'cybersecurity',
] as const);
