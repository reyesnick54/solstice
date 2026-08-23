import type { DataCategory } from '../../../personal-data-vault/src/taxonomy.ts';
import type { ConsentOperation, LegalHookStatus, PurposeCode } from '../taxonomy.ts';
import {
  CURRENT_DATA_TERMS_VERSION,
  type EconomicUseClass,
  type NecessityClass,
  type PermissionBundleId,
  type PurposeFamily,
} from './taxonomy.ts';

export type ProductPurpose = {
  readonly purposeId: string;
  readonly ledgerCode: PurposeCode;
  readonly version: number;
  readonly termsVersion: string;
  readonly family: PurposeFamily;
  readonly description: string;
  readonly necessity: NecessityClass;
  readonly eligibleDataCategories: readonly DataCategory[];
  readonly retentionDays: number | null;
  readonly shareable: boolean;
  readonly economicCompensationEligible: boolean;
  readonly economicUseClass: EconomicUseClass;
  readonly legalHook: LegalHookStatus;
  readonly requiredForBasicAccount: boolean;
};

export type PermissionBundle = {
  readonly bundleId: PermissionBundleId;
  readonly label: string;
  readonly description: string;
  readonly purposeId: string;
  readonly categories: readonly DataCategory[];
  readonly operations: readonly ConsentOperation[];
  readonly necessity: NecessityClass;
  readonly economicUseClass: EconomicUseClass;
};

const CATALOG = Object.freeze([
  Object.freeze({
    purposeId: 'core-account-service',
    ledgerCode: 'CORE_ACCOUNT_SERVICE',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'CORE_SERVICE',
    description: 'Required to operate the customer account, post journals, and keep regulatory records.',
    necessity: 'REQUIRED_FOR_CORE_SERVICE',
    eligibleDataCategories: Object.freeze([
      'IDENTITY_ATTRIBUTE',
      'TRANSACTION_DATA',
      'PAYROLL_DATA',
      'EXTERNAL_FINANCIAL_ACCOUNT_DATA',
    ]),
    retentionDays: 365,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: true,
  }),
  Object.freeze({
    purposeId: 'financial-analysis',
    ledgerCode: 'PERSONAL_BUDGET_ANALYSIS',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'FINANCIAL_ANALYSIS',
    description: 'Optional analysis of the subject\'s own spending and budget.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['TRANSACTION_DATA', 'PURCHASE_HISTORY', 'PREFERENCE_DATA']),
    retentionDays: 90,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'agent-assistance',
    ledgerCode: 'PERSONAL_AGENT_ANALYSIS',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'AGENT_ASSISTANCE',
    description: 'Optional Agent use of named data categories. Mandate permission is not enough.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['PAYROLL_DATA', 'TRANSACTION_DATA', 'PREFERENCE_DATA', 'PURCHASE_HISTORY']),
    retentionDays: 30,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'personalization',
    ledgerCode: 'PERSONALIZATION',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'PERSONALIZATION',
    description: 'Optional personalization of the subject\'s own experience. Does not authorize licensing.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['PREFERENCE_DATA', 'DEVICE_ACTIVITY_SUMMARY', 'USER_DECLARED_DATA']),
    retentionDays: 180,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'PERSONALIZATION',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'analytics',
    ledgerCode: 'ANALYTICS',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'ANALYTICS',
    description: 'Optional first-party analytics. Not marketing and not economic licensing.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['DEVICE_ACTIVITY_SUMMARY', 'PREFERENCE_DATA']),
    retentionDays: 90,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'product-improvement',
    ledgerCode: 'PRODUCT_IMPROVEMENT_RESEARCH',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'PRODUCT_IMPROVEMENT',
    description: 'Optional internal product-improvement research. Never implied by personalization.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['PREFERENCE_DATA', 'DEVICE_ACTIVITY_SUMMARY']),
    retentionDays: 30,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'aggregated-research',
    ledgerCode: 'AGGREGATED_RESEARCH',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'RESEARCH',
    description: 'Optional aggregated research. Does not authorize economic licensing or personalization.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['TRANSACTION_DATA', 'PREFERENCE_DATA']),
    retentionDays: 90,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'AGGREGATED_RESEARCH',
    legalHook: 'RESEARCH_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'data-licensing',
    ledgerCode: 'DATA_CONTRIBUTION_RESEARCH',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'DATA_LICENSING',
    description: 'Optional compensated data licensing. Requires explicit economic-use scope. Never a default.',
    necessity: 'OPTIONAL_COMPENSATED',
    eligibleDataCategories: Object.freeze(['TRANSACTION_DATA', 'PREFERENCE_DATA', 'DATA_CONTRIBUTION_CANDIDATE']),
    retentionDays: 30,
    shareable: true,
    economicCompensationEligible: true,
    economicUseClass: 'ECONOMIC_LICENSING',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'hin-participation',
    ledgerCode: 'HIN_PARTICIPATION',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'HIN_PARTICIPATION',
    description: 'Optional Human Information Network participation. Withdrawal does not close financial services.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze([
      'TRANSACTION_DATA',
      'PREFERENCE_DATA',
      'DATA_CONTRIBUTION_CANDIDATE',
      'DEVICE_ACTIVITY_SUMMARY',
    ]),
    retentionDays: 90,
    shareable: true,
    economicCompensationEligible: true,
    economicUseClass: 'NONE',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
    requiredForBasicAccount: false,
  }),
  Object.freeze({
    purposeId: 'marketing',
    ledgerCode: 'MARKETING',
    version: 1,
    termsVersion: CURRENT_DATA_TERMS_VERSION,
    family: 'MARKETING',
    description: 'Optional marketing where a jurisdiction pack allows it. Never required for account use.',
    necessity: 'OPTIONAL',
    eligibleDataCategories: Object.freeze(['PREFERENCE_DATA', 'IDENTITY_ATTRIBUTE']),
    retentionDays: 30,
    shareable: false,
    economicCompensationEligible: false,
    economicUseClass: 'NONE',
    legalHook: 'COUNSEL_REVIEW_REQUIRED',
    requiredForBasicAccount: false,
  }),
]);

export const PRODUCT_PURPOSE_CATALOG = CATALOG as readonly ProductPurpose[];

export const PERMISSION_BUNDLES = Object.freeze([
  Object.freeze({
    bundleId: 'AGENT_SPENDING_DATA',
    label: 'Allow SunRey Agent to use my spending data',
    description: 'Maps to TRANSACTION_DATA and PURCHASE_HISTORY for agent-assistance only.',
    purposeId: 'agent-assistance',
    categories: Object.freeze(['TRANSACTION_DATA', 'PURCHASE_HISTORY']),
    operations: Object.freeze(['READ', 'DERIVE', 'AGGREGATE']),
    necessity: 'OPTIONAL',
    economicUseClass: 'NONE',
  }),
  Object.freeze({
    bundleId: 'PERSONALIZATION_PREFERENCES',
    label: 'Personalize my SunRey experience',
    description: 'Preference and declared-data personalization. Not licensing.',
    purposeId: 'personalization',
    categories: Object.freeze(['PREFERENCE_DATA', 'USER_DECLARED_DATA']),
    operations: Object.freeze(['READ', 'DERIVE']),
    necessity: 'OPTIONAL',
    economicUseClass: 'PERSONALIZATION',
  }),
  Object.freeze({
    bundleId: 'HIN_OPTIONAL_PARTICIPATION',
    label: 'Join optional Human Information Network participation',
    description: 'HIN enrollment categories. Financial services stay available if withdrawn.',
    purposeId: 'hin-participation',
    categories: Object.freeze(['TRANSACTION_DATA', 'PREFERENCE_DATA', 'DATA_CONTRIBUTION_CANDIDATE']),
    operations: Object.freeze(['AGGREGATE', 'CONTRIBUTE']),
    necessity: 'OPTIONAL',
    economicUseClass: 'NONE',
  }),
  Object.freeze({
    bundleId: 'ECONOMIC_DATA_LICENSING',
    label: 'Allow compensated economic data licensing',
    description: 'Explicit economic-licensing scope. Never defaulted on.',
    purposeId: 'data-licensing',
    categories: Object.freeze(['TRANSACTION_DATA', 'PREFERENCE_DATA']),
    operations: Object.freeze(['CONTRIBUTE', 'AGGREGATE']),
    necessity: 'OPTIONAL_COMPENSATED',
    economicUseClass: 'ECONOMIC_LICENSING',
  }),
  Object.freeze({
    bundleId: 'AGGREGATED_RESEARCH',
    label: 'Allow aggregated research use',
    description: 'Aggregated research only. Does not imply licensing or personalization.',
    purposeId: 'aggregated-research',
    categories: Object.freeze(['TRANSACTION_DATA', 'PREFERENCE_DATA']),
    operations: Object.freeze(['AGGREGATE']),
    necessity: 'OPTIONAL',
    economicUseClass: 'AGGREGATED_RESEARCH',
  }),
]) as readonly PermissionBundle[];

export function listProductPurposes(): readonly ProductPurpose[] {
  return PRODUCT_PURPOSE_CATALOG;
}

export function purposeById(purposeId: string): ProductPurpose | undefined {
  return PRODUCT_PURPOSE_CATALOG.find((row) => row.purposeId === purposeId);
}

export function purposeByLedgerCode(code: string): ProductPurpose | undefined {
  return PRODUCT_PURPOSE_CATALOG.find((row) => row.ledgerCode === code);
}

export function expandPermissionBundle(bundleId: string): PermissionBundle | undefined {
  return PERMISSION_BUNDLES.find((row) => row.bundleId === bundleId);
}

export function defaultGrantedPurposeIds(): readonly string[] {
  return Object.freeze(
    PRODUCT_PURPOSE_CATALOG.filter((row) => row.necessity === 'REQUIRED_FOR_CORE_SERVICE').map((row) => row.purposeId),
  );
}
