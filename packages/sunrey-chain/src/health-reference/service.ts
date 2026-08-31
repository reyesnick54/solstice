/**
 * HealthReferenceService — canonical public health reference plane.
 * Reference knowledge only. No diagnosis, treatment, or user health inference.
 */

import type { Wave6FixtureProviders } from './adapters/fixture-adapters.ts';
import { createWave6FixtureProviders } from './adapters/fixture-adapters.ts';
import { HealthReferenceCache } from './cache.ts';
import { classifyPublicHealthReference } from './data-classification.ts';
import { markAsHinReferenceData, mayAttachGeneticsToUserProfile } from './hin-boundary.ts';
import {
  agentHealthInferenceBlocked,
  clampResultLimit,
  HEALTH_QUERY_LIMITS,
  privacySafeLogFields,
} from './limits.ts';
import { assertCompatibleBasis } from './nutrition-units.ts';
import type {
  ClinicalTrialObservation,
  DrugReference,
  FoodProduct,
  GeneticsReference,
  HealthcareProviderDirectoryEntry,
  HealthProviderHealth,
  HealthResearchContext,
  HealthServiceResult,
  MedicalDeviceReference,
  PublicHealthReference,
  WellnessReference,
} from './types.ts';

export type HealthReferenceServiceOptions = {
  readonly providers?: Wave6FixtureProviders;
  readonly cache?: HealthReferenceCache;
  readonly nowUtc?: () => string;
};

export class HealthReferenceService {
  readonly #providers: Wave6FixtureProviders;
  readonly #cache: HealthReferenceCache;
  readonly #nowUtc: () => string;

  constructor(options: HealthReferenceServiceOptions = {}) {
    this.#providers = options.providers ?? createWave6FixtureProviders();
    this.#cache = options.cache ?? new HealthReferenceCache();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  readonly dataClassification = classifyPublicHealthReference();
  readonly hinLayer = markAsHinReferenceData();
  readonly agentConstraints = agentHealthInferenceBlocked();

  listProviders(): readonly string[] {
    return Object.freeze(Object.keys(this.#providers));
  }

  allProviderHealth(): readonly HealthProviderHealth[] {
    return Object.freeze(Object.values(this.#providers).map((p) => p.health()));
  }

  searchFoods(query: string, limit?: number): HealthServiceResult<readonly FoodProduct[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxFoodResults);
    const key = `foods:${query}:${clamped}`;
    const cached = this.#cache.get<readonly FoodProduct[]>(key);
    if (cached) {
      return Object.freeze({ data: cached.value, providerId: 'cached', stale: cached.stale, degraded: false, warnings: Object.freeze([]) });
    }
    const all: FoodProduct[] = [];
    for (const provider of Object.values(this.#providers)) {
      const result = provider.searchFoodProducts?.(query, clamped);
      if (result) all.push(...result.data);
    }
    const data = Object.freeze(all.slice(0, clamped));
    this.#cache.set(key, data, 'food_product');
    return Object.freeze({
      data,
      providerId: data[0]?.providerId ?? 'none',
      stale: false,
      degraded: data.length === 0,
      warnings: Object.freeze(data.length === 0 ? ['no food products found'] : []),
    });
  }

  getFoodProduct(productId: string): HealthServiceResult<FoodProduct | null> {
    for (const provider of Object.values(this.#providers)) {
      const result = provider.getFoodProduct?.(productId);
      if (result?.data) {
        return Object.freeze({ data: result.data, providerId: result.providerId, stale: result.stale, degraded: false, warnings: Object.freeze([]) });
      }
    }
    return Object.freeze({ data: null, providerId: 'none', stale: true, degraded: true, warnings: Object.freeze(['product not found']) });
  }

  searchDrugs(query: string, limit?: number): HealthServiceResult<readonly DrugReference[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxDrugResults);
    const result = this.#providers.openfda.searchDrugs?.(query, clamped);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'openfda',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings: Object.freeze([]),
    });
  }

  searchDevices(query: string, limit?: number): HealthServiceResult<readonly MedicalDeviceReference[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxDrugResults);
    const result = this.#providers.openfda.searchDevices?.(query, clamped);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'openfda',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings: Object.freeze([]),
    });
  }

  searchGenetics(query: string, limit?: number): HealthServiceResult<readonly GeneticsReference[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxGeneticsResults);
    const result = this.#providers['medlineplus-genetics'].searchGenetics?.(query, clamped);
    const attachCheck = mayAttachGeneticsToUserProfile({
      hasUserGeneticData: false,
      userAuthorized: false,
      vaultPolicyPermits: false,
    });
    const warnings = attachCheck.allowed ? Object.freeze([]) : Object.freeze([attachCheck.reason]);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'medlineplus-genetics',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings,
    });
  }

  searchClinicalTrials(query: string, limit?: number): HealthServiceResult<readonly ClinicalTrialObservation[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxTrialResults);
    const result = this.#providers['clinicaltrials-gov'].searchClinicalTrials?.(query, clamped);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'clinicaltrials-gov',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings: Object.freeze(['informational only — not eligibility determination']),
    });
  }

  searchHealthcareProviders(query: string, limit?: number): HealthServiceResult<readonly HealthcareProviderDirectoryEntry[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.maxProviderResults);
    const result = this.#providers.nppes.searchHealthcareProviders?.(query, clamped);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'nppes',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings: Object.freeze(['directory only — not quality endorsement or insurance eligibility']),
    });
  }

  searchPublicHealth(query: string, limit?: number): HealthServiceResult<readonly PublicHealthReference[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.defaultLimit);
    const all: PublicHealthReference[] = [];
    for (const id of ['nhs-scotland-open-data', 'hdx-health'] as const) {
      const result = this.#providers[id].searchPublicHealth?.(query, clamped);
      if (result) all.push(...result.data);
    }
    return Object.freeze({
      data: Object.freeze(all.slice(0, clamped)),
      providerId: all[0]?.providerId ?? 'none',
      stale: false,
      degraded: all.length === 0,
      warnings: Object.freeze([]),
    });
  }

  searchWellness(query: string, limit?: number): HealthServiceResult<readonly WellnessReference[]> {
    const clamped = clampResultLimit(limit, HEALTH_QUERY_LIMITS.defaultLimit);
    const result = this.#providers['longevity-world-cup'].searchWellness?.(query, clamped);
    return Object.freeze({
      data: result?.data ?? Object.freeze([]),
      providerId: 'longevity-world-cup',
      stale: result?.stale ?? true,
      degraded: !result,
      warnings: Object.freeze(['research reference only']),
    });
  }

  compareNutritionBasis(a: FoodProduct, b: FoodProduct): { readonly compatible: boolean } {
    const aBasis = a.nutrition[0]?.basis;
    const bBasis = b.nutrition[0]?.basis;
    if (!aBasis || !bBasis) return { compatible: false };
    return { compatible: assertCompatibleBasis(aBasis, bBasis) };
  }

  buildResearchContext(): HealthResearchContext {
    return Object.freeze({
      foods: this.searchFoods('chicken', 5).data,
      trials: this.searchClinicalTrials('diabetes', 5).data,
      publicHealth: this.searchPublicHealth('health', 5).data,
      retrievedAt: this.#nowUtc(),
    });
  }

  privacySafeLog(meta: Record<string, unknown>): Record<string, unknown> {
    return privacySafeLogFields(meta);
  }
}

export function createHealthReferenceSandbox(options?: HealthReferenceServiceOptions): HealthReferenceService {
  return new HealthReferenceService(options);
}
