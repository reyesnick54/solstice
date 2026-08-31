/**
 * Health reference provider adapter base contract.
 */

import type {
  ClinicalTrialObservation,
  DrugReference,
  FoodProduct,
  GeneticsReference,
  HealthcareProviderDirectoryEntry,
  MedicalDeviceReference,
  HealthAdapterId,
  HealthProviderHealth,
  ProviderObservationEnvelope,
  PublicHealthReference,
  WellnessReference,
} from '../types.ts';

export type HealthProvider = {
  readonly providerId: HealthAdapterId;
  readonly capabilities: readonly string[];
  health(): HealthProviderHealth;
  searchFoodProducts?(query: string, limit: number): ProviderObservationEnvelope<readonly FoodProduct[]>;
  getFoodProduct?(productId: string): ProviderObservationEnvelope<FoodProduct | null>;
  searchDrugs?(query: string, limit: number): ProviderObservationEnvelope<readonly DrugReference[]>;
  searchDevices?(query: string, limit: number): ProviderObservationEnvelope<readonly MedicalDeviceReference[]>;
  searchGenetics?(query: string, limit: number): ProviderObservationEnvelope<readonly GeneticsReference[]>;
  searchClinicalTrials?(query: string, limit: number): ProviderObservationEnvelope<readonly ClinicalTrialObservation[]>;
  searchHealthcareProviders?(query: string, limit: number): ProviderObservationEnvelope<readonly HealthcareProviderDirectoryEntry[]>;
  getPublicHealth?(referenceId: string): ProviderObservationEnvelope<PublicHealthReference | null>;
  searchPublicHealth?(query: string, limit: number): ProviderObservationEnvelope<readonly PublicHealthReference[]>;
  searchWellness?(query: string, limit: number): ProviderObservationEnvelope<readonly WellnessReference[]>;
};

export type HealthProviderBundle = {
  readonly provider: HealthProvider;
  readonly providerId: HealthAdapterId;
};
