/**
 * Versioned Vault category registry.
 *
 * Speculative or highly sensitive categories may appear as RESEARCH_REQUIRED
 * and are not ingestible by default. Production availability is never implied.
 */

import type { DataCategory } from '../taxonomy.ts';
import type { ProductClassification } from './classification.ts';
import type { ProductRetentionPolicy } from './retention.ts';
import { RETENTION_POLICIES } from './retention.ts';

export const CATEGORY_REGISTRY_VERSION = 'sunrey.vault.category-registry.v1' as const;

export const VAULT_PURPOSES = [
  'VAULT_SELF_VIEW',
  'VAULT_SELF_MANAGE',
  'VAULT_CORRECTION',
  'VAULT_EXPORT',
  'AGENT_ANALYSIS',
  'PEG_DERIVATION',
  'CONSENT_REVIEW',
  'REGULATED_OPERATION',
] as const;
export type VaultPurpose = (typeof VAULT_PURPOSES)[number];

export const SHAREABILITY = ['NONE', 'SUBJECT_ONLY', 'CONSENT_SCOPED', 'PUBLIC'] as const;
export type Shareability = (typeof SHAREABILITY)[number];

export const PRODUCTION_AVAILABILITY = [
  'SANDBOX_AVAILABLE',
  'AUTHORIZED_ONLY',
  'RESEARCH_REQUIRED',
  'NOT_INGESTED_BY_DEFAULT',
] as const;
export type CategoryAvailability = (typeof PRODUCTION_AVAILABILITY)[number];

export type VaultCategoryId =
  | 'financial'
  | 'education'
  | 'employment'
  | 'skills'
  | 'professional_activity'
  | 'consumption'
  | 'mobility_location'
  | 'communications_metadata'
  | 'digital_activity'
  | 'attention_time'
  | 'creative_contribution'
  | 'social_contribution'
  | 'goals_preferences'
  | 'health_wellness'
  | 'biometric'
  | 'genetic'
  | 'identity_attribute';

export type VaultCategoryRecord = {
  readonly categoryId: VaultCategoryId;
  readonly version: typeof CATEGORY_REGISTRY_VERSION;
  readonly label: string;
  readonly classification: ProductClassification;
  readonly allowedPurposes: readonly VaultPurpose[];
  readonly retention: ProductRetentionPolicy;
  readonly shareability: Shareability;
  readonly agentAccessEligible: boolean;
  readonly economicRightsEligible: boolean;
  readonly legalReviewRequirement: 'NONE' | 'COUNSEL_REVIEW_REQUIRED';
  readonly availability: CategoryAvailability;
  readonly ingestEnabled: boolean;
  readonly liveMonetizationEnabled: false;
  readonly mappedAssetCategories: readonly DataCategory[];
};

function cat(input: Omit<VaultCategoryRecord, 'version' | 'liveMonetizationEnabled'>): VaultCategoryRecord {
  return Object.freeze({
    ...input,
    version: CATEGORY_REGISTRY_VERSION,
    liveMonetizationEnabled: false,
    allowedPurposes: Object.freeze([...input.allowedPurposes]),
    mappedAssetCategories: Object.freeze([...input.mappedAssetCategories]),
  });
}

const SELF = ['VAULT_SELF_VIEW', 'VAULT_SELF_MANAGE', 'VAULT_CORRECTION', 'VAULT_EXPORT'] as const;
const SELF_AGENT = [...SELF, 'AGENT_ANALYSIS'] as const;
const SELF_PEG_AGENT = [...SELF, 'PEG_DERIVATION', 'AGENT_ANALYSIS'] as const;

export const VAULT_CATEGORY_REGISTRY: readonly VaultCategoryRecord[] = Object.freeze([
  cat({
    categoryId: 'financial',
    label: 'Financial',
    classification: 'FINANCIAL_SENSITIVE',
    allowedPurposes: SELF_PEG_AGENT,
    retention: RETENTION_POLICIES.time_limited_730,
    shareability: 'SUBJECT_ONLY',
    agentAccessEligible: true,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['EXTERNAL_FINANCIAL_ACCOUNT_DATA', 'PAYROLL_DATA', 'TRANSACTION_DATA'],
  }),
  cat({
    categoryId: 'education',
    label: 'Education',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['USER_DECLARED_DATA'],
  }),
  cat({
    categoryId: 'employment',
    label: 'Employment',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['USER_DECLARED_DATA'],
  }),
  cat({
    categoryId: 'skills',
    label: 'Skills',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: true,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['USER_DECLARED_DATA'],
  }),
  cat({
    categoryId: 'professional_activity',
    label: 'Professional activity',
    classification: 'PERSONAL',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: true,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['DOCUMENT'],
  }),
  cat({
    categoryId: 'consumption',
    label: 'Consumption',
    classification: 'PERSONAL',
    allowedPurposes: SELF_PEG_AGENT,
    retention: RETENTION_POLICIES.time_limited_180,
    shareability: 'SUBJECT_ONLY',
    agentAccessEligible: true,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['PURCHASE_HISTORY', 'RECEIPT'],
  }),
  cat({
    categoryId: 'mobility_location',
    label: 'Mobility / location',
    classification: 'PERSONAL',
    allowedPurposes: ['VAULT_SELF_VIEW', 'VAULT_SELF_MANAGE', 'CONSENT_REVIEW'],
    retention: RETENTION_POLICIES.time_limited_180,
    shareability: 'NONE',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'AUTHORIZED_ONLY',
    ingestEnabled: false,
    mappedAssetCategories: ['LOCATION_SUMMARY'],
  }),
  cat({
    categoryId: 'communications_metadata',
    label: 'Communications metadata',
    classification: 'CONFIDENTIAL',
    allowedPurposes: ['VAULT_SELF_VIEW', 'CONSENT_REVIEW'],
    retention: RETENTION_POLICIES.time_limited_180,
    shareability: 'NONE',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'AUTHORIZED_ONLY',
    ingestEnabled: false,
    mappedAssetCategories: ['COMMUNICATION_METADATA'],
  }),
  cat({
    categoryId: 'digital_activity',
    label: 'Digital activity',
    classification: 'PERSONAL',
    allowedPurposes: ['VAULT_SELF_VIEW', 'VAULT_SELF_MANAGE'],
    retention: RETENTION_POLICIES.time_limited_180,
    shareability: 'SUBJECT_ONLY',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'AUTHORIZED_ONLY',
    ingestEnabled: false,
    mappedAssetCategories: ['DEVICE_ACTIVITY_SUMMARY'],
  }),
  cat({
    categoryId: 'attention_time',
    label: 'Attention / time',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: true,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['USER_DECLARED_DATA'],
  }),
  cat({
    categoryId: 'creative_contribution',
    label: 'Creative contribution',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: true,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['DATA_CONTRIBUTION_CANDIDATE'],
  }),
  cat({
    categoryId: 'social_contribution',
    label: 'Social contribution',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: true,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['DATA_CONTRIBUTION_CANDIDATE'],
  }),
  cat({
    categoryId: 'goals_preferences',
    label: 'Goals / preferences',
    classification: 'USER_PROVIDED',
    allowedPurposes: SELF_AGENT,
    retention: RETENTION_POLICIES.service_active,
    shareability: 'CONSENT_SCOPED',
    agentAccessEligible: true,
    economicRightsEligible: false,
    legalReviewRequirement: 'NONE',
    availability: 'SANDBOX_AVAILABLE',
    ingestEnabled: true,
    mappedAssetCategories: ['PREFERENCE_DATA', 'USER_DECLARED_DATA'],
  }),
  cat({
    categoryId: 'health_wellness',
    label: 'Health / wellness',
    classification: 'HEALTH_SENSITIVE',
    allowedPurposes: ['VAULT_SELF_VIEW', 'CONSENT_REVIEW'],
    retention: RETENTION_POLICIES.legal_hold,
    shareability: 'NONE',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'RESEARCH_REQUIRED',
    ingestEnabled: false,
    mappedAssetCategories: [],
  }),
  cat({
    categoryId: 'biometric',
    label: 'Biometric',
    classification: 'BIOMETRIC_SENSITIVE',
    allowedPurposes: ['CONSENT_REVIEW'],
    retention: RETENTION_POLICIES.legal_hold,
    shareability: 'NONE',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'NOT_INGESTED_BY_DEFAULT',
    ingestEnabled: false,
    mappedAssetCategories: [],
  }),
  cat({
    categoryId: 'genetic',
    label: 'Genetic',
    classification: 'GENETIC_SENSITIVE',
    allowedPurposes: ['CONSENT_REVIEW'],
    retention: RETENTION_POLICIES.legal_hold,
    shareability: 'NONE',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'NOT_INGESTED_BY_DEFAULT',
    ingestEnabled: false,
    mappedAssetCategories: [],
  }),
  cat({
    categoryId: 'identity_attribute',
    label: 'Identity attribute',
    classification: 'IDENTITY_SENSITIVE',
    allowedPurposes: ['VAULT_SELF_VIEW', 'REGULATED_OPERATION'],
    retention: RETENTION_POLICIES.evidence,
    shareability: 'SUBJECT_ONLY',
    agentAccessEligible: false,
    economicRightsEligible: false,
    legalReviewRequirement: 'COUNSEL_REVIEW_REQUIRED',
    availability: 'AUTHORIZED_ONLY',
    ingestEnabled: false,
    mappedAssetCategories: ['IDENTITY_ATTRIBUTE'],
  }),
]);

export class VaultCategoryRegistry {
  private readonly byId = new Map<VaultCategoryId, VaultCategoryRecord>();

  constructor(seed: readonly VaultCategoryRecord[] = VAULT_CATEGORY_REGISTRY) {
    for (const row of seed) {
      this.byId.set(row.categoryId, row);
    }
  }

  version(): typeof CATEGORY_REGISTRY_VERSION {
    return CATEGORY_REGISTRY_VERSION;
  }

  get(categoryId: string): VaultCategoryRecord | undefined {
    return this.byId.get(categoryId as VaultCategoryId);
  }

  list(): readonly VaultCategoryRecord[] {
    return Object.freeze([...this.byId.values()]);
  }

  listIngestible(): readonly VaultCategoryRecord[] {
    return Object.freeze([...this.byId.values()].filter((row) => row.ingestEnabled));
  }

  fromAssetCategory(category: DataCategory): VaultCategoryRecord {
    const found = [...this.byId.values()].find((row) => row.mappedAssetCategories.includes(category));
    return found ?? this.byId.get('goals_preferences')!;
  }

  purposeAllowed(categoryId: string, purpose: VaultPurpose): boolean {
    const row = this.get(categoryId);
    return row ? row.allowedPurposes.includes(purpose) : false;
  }
}

export const DEFAULT_CATEGORY_REGISTRY = new VaultCategoryRegistry();
