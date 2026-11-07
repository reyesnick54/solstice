/**
 * HELIOS ALT02 — alternative-data rights taxonomy.
 * UNKNOWN license class is always blocked; rights are never inferred.
 */

export const ALTERNATIVE_DATA_RIGHTS_SCHEMA_VERSION = 'sunrey.helios.alt02.rights.v1' as const;

export const ALTERNATIVE_DATA_LICENSE_CLASSES = [
  'PUBLIC_OPEN',
  'PUBLIC_RESTRICTED',
  'COMMERCIAL_LICENSED',
  'ENTERPRISE_LICENSED',
  'INTERNAL_PROPRIETARY',
  'RESEARCH_ONLY',
  'UNKNOWN',
] as const;
export type AlternativeDataLicenseClass = (typeof ALTERNATIVE_DATA_LICENSE_CLASSES)[number];

export const PERMITTED_PURPOSES = [
  'RESEARCH',
  'MODEL_TRAINING',
  'BACKTEST',
  'PAPER',
  'PRODUCTION_RESEARCH',
  'DERIVED_FEATURE_STORAGE',
] as const;
export type PermittedPurpose = (typeof PERMITTED_PURPOSES)[number];

export const ALTERNATIVE_DATA_GATE_OUTCOMES = [
  'ENTITLEMENT_ACTIVE',
  'ENTITLEMENT_EXPIRED',
  'ENTITLEMENT_REVOKED',
  'PURPOSE_NOT_PERMITTED',
  'LICENSE_UNKNOWN',
] as const;
export type AlternativeDataGateOutcome = (typeof ALTERNATIVE_DATA_GATE_OUTCOMES)[number];

export const PROVIDER_REVOCATION_STATES = ['ENTITLEMENT_ACTIVE', 'ENTITLEMENT_EXPIRED', 'ENTITLEMENT_REVOKED'] as const;
export type ProviderRevocationStateKind = (typeof PROVIDER_REVOCATION_STATES)[number];

/** Acquisition paths HELIOS must never authorize or attest as permitted. */
export const PROHIBITED_ACQUISITION_PRACTICES = [
  'CIRCUMVENTING_PAYWALLS',
  'BYPASSING_AUTHENTICATION',
  'ROBOTS_OR_TERMS_EVASION',
  'UNAUTHORIZED_SCRAPING',
  'CREDENTIAL_SHARING',
  'PERSONAL_DEVICE_TRACKING',
  'PURCHASING_ILLEGALLY_OBTAINED_DATA',
  'MNPI_INGESTION',
  'SENSITIVE_PERSONAL_DATA_TARGETING',
] as const;
export type ProhibitedAcquisitionPractice = (typeof PROHIBITED_ACQUISITION_PRACTICES)[number];

/** Individual-level signal classes that must not drive investment research features. */
export const PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS = [
  'HEALTH',
  'RELIGION',
  'RACE',
  'SEXUAL_BEHAVIOR',
  'PRIVATE_LOCATION_HISTORY',
  'PRIVATE_FINANCIAL_TRANSACTIONS',
] as const;
export type ProhibitedIndividualSensitiveSignal = (typeof PROHIBITED_INDIVIDUAL_SENSITIVE_SIGNALS)[number];

export function isAlternativeDataLicenseClass(value: string): value is AlternativeDataLicenseClass {
  return (ALTERNATIVE_DATA_LICENSE_CLASSES as readonly string[]).includes(value);
}

export function isPermittedPurpose(value: string): value is PermittedPurpose {
  return (PERMITTED_PURPOSES as readonly string[]).includes(value);
}

export function licenseClassBlocksByDefault(licenseClass: AlternativeDataLicenseClass): boolean {
  return licenseClass === 'UNKNOWN';
}
