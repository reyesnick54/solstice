/**
 * Phase H Prompt 4 — Information Rights Marketplace vocabularies.
 *
 * Extends packages/information-market. Not a second marketplace,
 * licensing package, or unrestricted sale of personal data.
 */

export const LICENSE_PURPOSES = [
  'RESEARCH',
  'PRODUCT_IMPROVEMENT',
  'AGGREGATED_ANALYTICS',
  'STATISTICAL_INSIGHT',
  'MODEL_EVALUATION',
  'MARKETING',
  'CREDIT_DECISIONING',
  'INSURANCE_UNDERWRITING',
  'EMPLOYMENT_SCREENING',
] as const;
export type LicensePurpose = (typeof LICENSE_PURPOSES)[number];

export const HEIGHTENED_PURPOSES = [
  'MARKETING',
  'CREDIT_DECISIONING',
  'INSURANCE_UNDERWRITING',
  'EMPLOYMENT_SCREENING',
] as const satisfies readonly LicensePurpose[];

export const SENSITIVE_CATEGORIES = [
  'HEALTH_WELLNESS',
  'MOBILITY_LOCATION',
] as const;

export const RIGHT_STATUSES = ['ACTIVE', 'PAUSED', 'REVOKED', 'EXPIRED', 'WITHDRAWN'] as const;
export type InformationRightStatus = (typeof RIGHT_STATUSES)[number];

export const TRANSFERABILITY = ['NON_TRANSFERABLE', 'LICENSEABLE_ONLY'] as const;
export type Transferability = (typeof TRANSFERABILITY)[number];

export const LICENSEABILITY = ['LICENSEABLE', 'NOT_LICENSEABLE'] as const;
export type Licenseability = (typeof LICENSEABILITY)[number];

export const DATA_PRODUCT_FORMS = [
  'INDIVIDUAL_AUTHORIZED_PACKAGE',
  'AGGREGATED_DATASET',
  'DERIVED_METRIC',
  'STATISTICAL_INSIGHT',
  'RESEARCH_COHORT',
  'HIN_AGGREGATE',
  'API_QUERY_ACCESS',
] as const;
export type DataProductForm = (typeof DATA_PRODUCT_FORMS)[number];

export const PREFERRED_PRIVACY_FORMS = [
  'AGGREGATED_DATASET',
  'DERIVED_METRIC',
  'STATISTICAL_INSIGHT',
  'RESEARCH_COHORT',
  'HIN_AGGREGATE',
] as const satisfies readonly DataProductForm[];

export const ACCESS_MODES = [
  'CONTROLLED_API',
  'SECURE_EXPORT',
  'APPROVED_QUERY',
  'PRIVACY_PRESERVING_AGGREGATE',
] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const LICENSE_STATUSES = [
  'PROPOSED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
  'TERMINATED',
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const PRICING_MODELS = ['FIXED', 'USAGE_BASED', 'SUBSCRIPTION', 'NEGOTIATED'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const COMPENSATION_RECIPIENT_CLASSES = [
  'INDIVIDUAL_RIGHTS_HOLDER',
  'CONTRIBUTION_POOL',
  'COMMUNITY_POOL',
  'SUNREY_FEE',
  'OTHER_APPROVED',
] as const;
export type CompensationRecipientClass = (typeof COMPENSATION_RECIPIENT_CLASSES)[number];

export const COMPENSATION_ASSETS = ['FIAT_MONEY', 'SUNREY_COIN'] as const;
export type MarketplaceCompensationAsset = (typeof COMPENSATION_ASSETS)[number];

export const ACCESS_KINDS = ['API', 'SECURE_EXPORT', 'APPROVED_QUERY', 'AGGREGATE_OUTPUT'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];

export const PARTICIPATION_STATUSES = ['ACTIVE', 'PAUSED', 'WITHDRAWN'] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const LICENSE_TRANSITIONS: Readonly<Record<LicenseStatus, readonly LicenseStatus[]>> = Object.freeze({
  PROPOSED: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['SUSPENDED', 'REVOKED', 'EXPIRED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'REVOKED', 'TERMINATED'],
  REVOKED: [],
  EXPIRED: [],
  TERMINATED: [],
});

export const EVIDENCE_KIND_RIGHTS_MARKETPLACE = 'INFORMATION_RIGHTS_MARKETPLACE';

export const MARKETPLACE_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const,
  counselConfirmed: false,
  productionActivated: false,
  liveDataMonetization: false,
  unrestrictedPersonalDataSale: false,
  differentialPrivacyClaimed: false,
  compensationGuaranteed: false,
  marketplaceCanMint: false,
  note: 'Simulation rights marketplace. Not an unrestricted sale of personal data. Not legal advice.',
});

export const PRODUCTION_ACTIVE = false as const;
export const RAW_DATABASE_ACCESS = false as const;
export const AUCTION_SUPPORTED = false as const;

export function canTransitionLicense(from: LicenseStatus, to: LicenseStatus): boolean {
  return LICENSE_TRANSITIONS[from].includes(to);
}

export function purposeIsHeightened(purpose: LicensePurpose): boolean {
  return (HEIGHTENED_PURPOSES as readonly string[]).includes(purpose);
}

export function formIsPrivacyPreferred(form: DataProductForm): boolean {
  return (PREFERRED_PRIVACY_FORMS as readonly string[]).includes(form);
}
