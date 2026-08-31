/**
 * Wave 6 health reference fixture data.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ClinicalTrialObservation,
  DrugReference,
  FoodProduct,
  GeneticsReference,
  HealthcareProviderDirectoryEntry,
  MedicalDeviceReference,
  PublicHealthReference,
  WellnessReference,
} from '../types.ts';

const NOW = '2026-08-31T12:00:00.000Z' as UtcInstant;

function freshness(providerId: string) {
  return Object.freeze({
    freshnessStatus: 'fresh' as const,
    retrievedAt: NOW,
    sourceEffectiveAt: NOW,
    sourceUrl: `https://fixture.sunrey.dev/${providerId}`,
  });
}

function provenance(providerId: string, capability: string) {
  return Object.freeze({
    providerId,
    capability,
    simulation: true as const,
    rawPayloadHash: `fixture-${providerId}-${capability}`,
  });
}

export const FIXTURE_FOOD_PRODUCTS: readonly FoodProduct[] = Object.freeze([
  Object.freeze({
    productId: 'off-3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    barcode: '3017620422003',
    servingSize: 15,
    servingUnit: 'g',
    ingredients: Object.freeze(['sugar', 'palm oil', 'hazelnuts', 'cocoa', 'skimmed milk powder']),
    allergens: Object.freeze(['milk', 'nuts']),
    nutrition: Object.freeze([
      { nutrient: 'energy', value: 80, unit: 'kcal' as const, basis: 'per_serving' as const, sourceValue: 80, sourceBasis: 'per_serving' as const },
      { nutrient: 'fat', value: 4.6, unit: 'g' as const, basis: 'per_serving' as const, sourceValue: 4.6, sourceBasis: 'per_serving' as const },
      { nutrient: 'sugar', value: 8.4, unit: 'g' as const, basis: 'per_serving' as const, sourceValue: 8.4, sourceBasis: 'per_serving' as const },
    ]),
    categories: Object.freeze(['spreads', 'breakfast']),
    country: 'FR',
    providerId: 'open-food-facts',
    authorityClass: 'community_data',
    freshness: freshness('open-food-facts'),
    provenance: provenance('open-food-facts', 'food_product'),
    referenceOnly: true as const,
  }),
  Object.freeze({
    productId: 'fdc-173944',
    name: 'Chicken, broiler, breast, meat only, raw',
    brand: null,
    barcode: null,
    servingSize: 100,
    servingUnit: 'g',
    ingredients: Object.freeze(['chicken breast']),
    allergens: Object.freeze([]),
    nutrition: Object.freeze([
      { nutrient: 'energy', value: 120, unit: 'kcal' as const, basis: 'per_100g' as const, sourceValue: 120, sourceBasis: 'per_100g' as const },
      { nutrient: 'protein', value: 22.5, unit: 'g' as const, basis: 'per_100g' as const, sourceValue: 22.5, sourceBasis: 'per_100g' as const },
      { nutrient: 'fat', value: 2.6, unit: 'g' as const, basis: 'per_100g' as const, sourceValue: 2.6, sourceBasis: 'per_100g' as const },
      { nutrient: 'sodium', value: 77, unit: 'mg' as const, basis: 'per_100g' as const, sourceValue: 77, sourceBasis: 'per_100g' as const },
    ]),
    categories: Object.freeze(['poultry', 'meat']),
    country: 'US',
    providerId: 'usda-fooddata-central',
    authorityClass: 'authoritative_official',
    freshness: freshness('usda-fooddata-central'),
    provenance: provenance('usda-fooddata-central', 'food_product'),
    referenceOnly: true as const,
  }),
]);

export const FIXTURE_DRUGS: readonly DrugReference[] = Object.freeze([
  Object.freeze({
    drugId: 'openfda-ibuprofen-001',
    productName: 'Ibuprofen 200mg Tablet',
    activeIngredient: 'IBUPROFEN',
    manufacturer: 'Example Pharma Inc.',
    labelSummary: 'Nonsteroidal anti-inflammatory drug for pain relief.',
    recallInfo: null,
    enforcementInfo: null,
    providerId: 'openfda',
    authorityClass: 'authoritative_official',
    freshness: freshness('openfda'),
    provenance: provenance('openfda', 'drug_reference'),
    referenceOnly: true as const,
    notPrescribingAdvice: true as const,
  }),
]);

export const FIXTURE_DEVICES: readonly MedicalDeviceReference[] = Object.freeze([
  Object.freeze({
    deviceId: 'openfda-device-glucometer-001',
    deviceName: 'Blood Glucose Monitoring System',
    manufacturer: 'MedDevice Corp',
    deviceClass: 'Class II',
    eventSummary: 'Reported calibration drift in batch MD-2024.',
    recallInfo: null,
    providerId: 'openfda',
    authorityClass: 'authoritative_official',
    freshness: freshness('openfda'),
    provenance: provenance('openfda', 'medical_device_reference'),
    referenceOnly: true as const,
  }),
]);

export const FIXTURE_GENETICS: readonly GeneticsReference[] = Object.freeze([
  Object.freeze({
    geneId: 'BRCA1',
    geneName: 'BRCA1 DNA repair associated',
    condition: 'Hereditary breast and ovarian cancer syndrome',
    inheritance: 'Autosomal dominant',
    description: 'BRCA1 provides instructions for making a protein that acts as a tumor suppressor.',
    references: Object.freeze(['https://medlineplus.gov/genetics/gene/brca1/']),
    providerId: 'medlineplus-genetics',
    authorityClass: 'authoritative_official',
    freshness: freshness('medlineplus-genetics'),
    provenance: provenance('medlineplus-genetics', 'genetics_reference'),
    educationalOnly: true as const,
    notPersonalizedInterpretation: true as const,
  }),
]);

export const FIXTURE_CLINICAL_TRIALS: readonly ClinicalTrialObservation[] = Object.freeze([
  Object.freeze({
    trialId: 'NCT04280705',
    title: 'Study of Treatment X in Type 2 Diabetes',
    condition: 'Type 2 Diabetes Mellitus',
    phase: 'Phase 3',
    status: 'Recruiting',
    interventions: Object.freeze(['Drug: Treatment X', 'Placebo']),
    locations: Object.freeze(['Boston, MA, USA', 'Chicago, IL, USA']),
    eligibilitySummary: 'Adults 18-75 with diagnosed T2DM. See protocol for full criteria.',
    sponsor: 'Example Pharma Research',
    startDate: '2024-01-15',
    completionDate: '2026-12-31',
    providerId: 'clinicaltrials-gov',
    authorityClass: 'authoritative_official',
    freshness: freshness('clinicaltrials-gov'),
    provenance: provenance('clinicaltrials-gov', 'clinical_trials'),
    informationalOnly: true as const,
    notEligibilityDetermination: true as const,
  }),
]);

export const FIXTURE_HEALTHCARE_PROVIDERS: readonly HealthcareProviderDirectoryEntry[] = Object.freeze([
  Object.freeze({
    providerIdentifier: '1234567890',
    name: 'Jane Smith, MD',
    organization: 'City Medical Group',
    specialty: 'Internal Medicine',
    taxonomy: '207R00000X',
    location: 'Boston, MA 02115',
    status: 'Active',
    providerId: 'nppes',
    authorityClass: 'authoritative_official',
    freshness: freshness('nppes'),
    provenance: provenance('nppes', 'healthcare_provider_reference'),
    directoryOnly: true as const,
    notQualityEndorsement: true as const,
    notInsuranceEligibility: true as const,
  }),
]);

export const FIXTURE_PUBLIC_HEALTH: readonly PublicHealthReference[] = Object.freeze([
  Object.freeze({
    referenceId: 'nhs-scot-waiting-2026-q2',
    title: 'NHS Scotland Waiting Times — Orthopaedics',
    description: 'Median waiting time for orthopaedic outpatient appointments in Scotland.',
    jurisdiction: 'Scotland',
    metric: 'median_wait_weeks',
    value: '12',
    unit: 'weeks',
    providerId: 'nhs-scotland-open-data',
    authorityClass: 'authoritative_official',
    freshness: freshness('nhs-scotland-open-data'),
    provenance: provenance('nhs-scotland-open-data', 'public_health'),
    aggregateOnly: true as const,
  }),
  Object.freeze({
    referenceId: 'hdx-cholera-outbreak-2026',
    title: 'Cholera Outbreak Monitoring Dataset',
    description: 'Humanitarian health dataset tracking cholera case reports.',
    jurisdiction: 'global',
    metric: 'active_outbreaks',
    value: '3',
    unit: 'count',
    providerId: 'hdx-health',
    authorityClass: 'research_data',
    freshness: freshness('hdx-health'),
    provenance: provenance('hdx-health', 'public_health'),
    aggregateOnly: true as const,
  }),
]);

export const FIXTURE_WELLNESS: readonly WellnessReference[] = Object.freeze([
  Object.freeze({
    referenceId: 'lwc-vo2max-benchmark-40-49',
    title: 'VO2 Max Benchmark — Ages 40-49',
    description: 'Population reference benchmark for cardiorespiratory fitness.',
    category: 'cardiorespiratory',
    benchmark: '38 ml/kg/min (median)',
    providerId: 'longevity-world-cup',
    authorityClass: 'research_data',
    freshness: freshness('longevity-world-cup'),
    provenance: provenance('longevity-world-cup', 'wellness_reference'),
    researchOnly: true as const,
  }),
]);

export const FIXTURE_STALE_FOOD: FoodProduct = Object.freeze({
  ...FIXTURE_FOOD_PRODUCTS[0]!,
  freshness: Object.freeze({
    freshnessStatus: 'stale' as const,
    retrievedAt: '2026-08-01T12:00:00.000Z' as UtcInstant,
    sourceEffectiveAt: '2026-01-01T00:00:00.000Z' as UtcInstant,
    sourceUrl: 'https://fixture.sunrey.dev/open-food-facts/stale',
  }),
});
