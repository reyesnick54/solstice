/**
 * Wave 6 health / HIN public reference data canonical types.
 * Reference knowledge only — not user medical records, diagnoses, or treatment plans.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/index.ts';

/** Health reference observation types — public external knowledge only. */
export const HEALTH_REFERENCE_TYPES = Object.freeze({
  DRUG: 'DRUG',
  MEDICAL_DEVICE: 'MEDICAL_DEVICE',
  GENETICS: 'GENETICS',
  CLINICAL_TRIAL: 'CLINICAL_TRIAL',
  HEALTHCARE_PROVIDER: 'HEALTHCARE_PROVIDER',
  PUBLIC_HEALTH: 'PUBLIC_HEALTH',
  NUTRITION: 'NUTRITION',
  FOOD: 'FOOD',
  WELLNESS: 'WELLNESS',
} as const);

export type HealthReferenceType = (typeof HEALTH_REFERENCE_TYPES)[keyof typeof HEALTH_REFERENCE_TYPES];

export const HEALTH_ADAPTER_IDS = [
  'open-food-facts',
  'usda-fooddata-central',
  'medlineplus-genetics',
  'openfda',
  'nppes',
  'clinicaltrials-gov',
  'nhs-scotland-open-data',
  'hdx-health',
  'longevity-world-cup',
] as const;

export type HealthAdapterId = (typeof HEALTH_ADAPTER_IDS)[number];

export type FreshnessInfo = {
  readonly freshnessStatus: 'fresh' | 'stale' | 'expired' | 'unknown';
  readonly retrievedAt: UtcInstant;
  readonly sourceEffectiveAt: UtcInstant | null;
  readonly sourceUrl: string | null;
};

export type ProvenanceInfo = {
  readonly providerId: string;
  readonly capability: string;
  readonly simulation: true;
  readonly rawPayloadHash: string;
};

export type ServingBasis = 'per_serving' | 'per_100g' | 'per_100ml' | 'per_unit';

export type NutritionUnit = 'kcal' | 'g' | 'mg' | 'mcg' | 'iu';

export type NutritionValue = {
  readonly nutrient: string;
  readonly value: number;
  readonly unit: NutritionUnit;
  readonly basis: ServingBasis;
  readonly sourceValue?: number;
  readonly sourceBasis?: ServingBasis;
  readonly normalizedValue?: number;
  readonly normalizedBasis?: ServingBasis;
  readonly conversionMethod?: string;
};

export type NutritionObservation = {
  readonly observationId: string;
  readonly productId: string | null;
  readonly nutrients: readonly NutritionValue[];
  readonly servingSize: number | null;
  readonly servingUnit: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly referenceOnly: true;
};

export type FoodProduct = {
  readonly productId: string;
  readonly name: string;
  readonly brand: string | null;
  readonly barcode: string | null;
  readonly servingSize: number | null;
  readonly servingUnit: string | null;
  readonly ingredients: readonly string[];
  readonly allergens: readonly string[];
  readonly nutrition: readonly NutritionValue[];
  readonly categories: readonly string[];
  readonly country: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly referenceOnly: true;
};

export type DrugReference = {
  readonly drugId: string;
  readonly productName: string;
  readonly activeIngredient: string | null;
  readonly manufacturer: string | null;
  readonly labelSummary: string | null;
  readonly recallInfo: string | null;
  readonly enforcementInfo: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly referenceOnly: true;
  readonly notPrescribingAdvice: true;
};

export type MedicalDeviceReference = {
  readonly deviceId: string;
  readonly deviceName: string;
  readonly manufacturer: string | null;
  readonly deviceClass: string | null;
  readonly eventSummary: string | null;
  readonly recallInfo: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly referenceOnly: true;
};

export type GeneticsReference = {
  readonly geneId: string;
  readonly geneName: string;
  readonly condition: string | null;
  readonly inheritance: string | null;
  readonly description: string;
  readonly references: readonly string[];
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly educationalOnly: true;
  readonly notPersonalizedInterpretation: true;
};

export type ClinicalTrialObservation = {
  readonly trialId: string;
  readonly title: string;
  readonly condition: string | null;
  readonly phase: string | null;
  readonly status: string;
  readonly interventions: readonly string[];
  readonly locations: readonly string[];
  readonly eligibilitySummary: string | null;
  readonly sponsor: string | null;
  readonly startDate: string | null;
  readonly completionDate: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly informationalOnly: true;
  readonly notEligibilityDetermination: true;
};

export type HealthcareProviderDirectoryEntry = {
  readonly providerIdentifier: string;
  readonly name: string;
  readonly organization: string | null;
  readonly specialty: string | null;
  readonly taxonomy: string | null;
  readonly location: string | null;
  readonly status: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly directoryOnly: true;
  readonly notQualityEndorsement: true;
  readonly notInsuranceEligibility: true;
};

export type PublicHealthReference = {
  readonly referenceId: string;
  readonly title: string;
  readonly description: string;
  readonly jurisdiction: string | null;
  readonly metric: string | null;
  readonly value: string | null;
  readonly unit: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly aggregateOnly: true;
};

export type WellnessReference = {
  readonly referenceId: string;
  readonly title: string;
  readonly description: string;
  readonly category: string | null;
  readonly benchmark: string | null;
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
  readonly researchOnly: true;
};

export type HealthReferenceObservation = {
  readonly observationId: string;
  readonly referenceType: HealthReferenceType;
  readonly title: string;
  readonly description: string;
  readonly classification: 'PUBLIC_HEALTH_REFERENCE';
  readonly sourceEntityId: string | null;
  readonly jurisdiction: string | null;
  readonly effectiveAt: UtcInstant;
  readonly sourceTimestamp: UtcInstant | null;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
  readonly authorityClass: AuthorityClass;
  readonly confidence: number;
  readonly provenance: ProvenanceInfo;
  readonly referenceOnly: true;
};

export type ProviderObservationEnvelope<T> = {
  readonly providerId: string;
  readonly capability: string;
  readonly collectedAtUtc: UtcInstant;
  readonly sourceTimestampUtc: UtcInstant;
  readonly stale: boolean;
  readonly simulation: true;
  readonly data: T;
};

export type HealthServiceResult<T> = {
  readonly data: T;
  readonly providerId: string;
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};

export type HealthProviderHealth = {
  readonly providerId: string;
  readonly healthy: boolean;
  readonly degraded: boolean;
  readonly message: string;
  readonly capabilities: readonly string[];
};

export type HealthResearchContext = {
  readonly foods: readonly FoodProduct[];
  readonly trials: readonly ClinicalTrialObservation[];
  readonly publicHealth: readonly PublicHealthReference[];
  readonly retrievedAt: string;
};
