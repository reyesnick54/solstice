/**
 * Wave 6 fixture-backed health reference provider adapters.
 * Simulation only — no live provider HTTP.
 */

import type { HealthProvider } from './base.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  ClinicalTrialObservation,
  DrugReference,
  FoodProduct,
  GeneticsReference,
  HealthcareProviderDirectoryEntry,
  HealthAdapterId,
  HealthProviderHealth,
  MedicalDeviceReference,
  ProviderObservationEnvelope,
  PublicHealthReference,
  WellnessReference,
} from '../types.ts';
import {
  FIXTURE_CLINICAL_TRIALS,
  FIXTURE_DEVICES,
  FIXTURE_DRUGS,
  FIXTURE_FOOD_PRODUCTS,
  FIXTURE_GENETICS,
  FIXTURE_HEALTHCARE_PROVIDERS,
  FIXTURE_PUBLIC_HEALTH,
  FIXTURE_WELLNESS,
} from '../fixtures/data.ts';

type Clock = { readonly nowUtc: () => string };

const defaultClock = (): Clock => ({ nowUtc: () => new Date().toISOString() });

function envelope<T>(
  providerId: string,
  capability: string,
  data: T,
  clock: Clock,
  stale = false,
): ProviderObservationEnvelope<T> {
  return Object.freeze({
    providerId,
    capability,
    collectedAtUtc: clock.nowUtc() as UtcInstant,
    sourceTimestampUtc: clock.nowUtc() as UtcInstant,
    stale,
    simulation: true as const,
    data,
  });
}

abstract class BaseFixtureHealthProvider implements HealthProvider {
  abstract readonly providerId: HealthAdapterId;
  abstract readonly capabilities: readonly string[];
  protected readonly clock: Clock;
  private healthy = true;
  private degraded = false;
  private message = 'fixture healthy';

  constructor(clock: Clock = defaultClock()) {
    this.clock = clock;
  }

  markUnhealthy(message: string): void {
    this.healthy = false;
    this.message = message;
  }

  markDegraded(message: string): void {
    this.degraded = true;
    this.message = message;
  }

  markRateLimited(): void {
    this.degraded = true;
    this.message = 'rate limited (429)';
  }

  markTimeout(): void {
    this.healthy = false;
    this.message = 'provider timeout';
  }

  health(): HealthProviderHealth {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      capabilities: this.capabilities,
    });
  }
}

export class OpenFoodFactsFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'open-food-facts' as const;
  readonly capabilities = Object.freeze(['food_product', 'nutrition', 'food_reference']);

  searchFoodProducts(query: string, limit: number): ProviderObservationEnvelope<readonly FoodProduct[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_FOOD_PRODUCTS.filter(
      (p) => p.providerId === this.providerId && (p.name.toLowerCase().includes(q) || p.barcode?.includes(q)),
    ).slice(0, limit);
    return envelope(this.providerId, 'food_product', results, this.clock);
  }

  getFoodProduct(productId: string): ProviderObservationEnvelope<FoodProduct | null> {
    const product = FIXTURE_FOOD_PRODUCTS.find((p) => p.productId === productId && p.providerId === this.providerId) ?? null;
    return envelope(this.providerId, 'food_product', product, this.clock);
  }
}

export class UsdaFoodDataCentralFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'usda-fooddata-central' as const;
  readonly capabilities = Object.freeze(['food_product', 'nutrition', 'food_reference']);

  searchFoodProducts(query: string, limit: number): ProviderObservationEnvelope<readonly FoodProduct[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_FOOD_PRODUCTS.filter(
      (p) => p.providerId === this.providerId && p.name.toLowerCase().includes(q),
    ).slice(0, limit);
    return envelope(this.providerId, 'food_product', results, this.clock);
  }

  getFoodProduct(productId: string): ProviderObservationEnvelope<FoodProduct | null> {
    const product = FIXTURE_FOOD_PRODUCTS.find((p) => p.productId === productId) ?? null;
    return envelope(this.providerId, 'food_product', product, this.clock);
  }
}

export class MedlinePlusGeneticsFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'medlineplus-genetics' as const;
  readonly capabilities = Object.freeze(['genetics_reference', 'health_reference']);

  searchGenetics(query: string, limit: number): ProviderObservationEnvelope<readonly GeneticsReference[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_GENETICS.filter(
      (g) => g.geneName.toLowerCase().includes(q) || g.geneId.toLowerCase().includes(q),
    ).slice(0, limit);
    return envelope(this.providerId, 'genetics_reference', results, this.clock);
  }
}

export class OpenFdaFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'openfda' as const;
  readonly capabilities = Object.freeze(['drug_reference', 'medical_device_reference', 'health_reference']);

  searchDrugs(query: string, limit: number): ProviderObservationEnvelope<readonly DrugReference[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_DRUGS.filter(
      (d) => d.productName.toLowerCase().includes(q) || (d.activeIngredient?.toLowerCase().includes(q) ?? false),
    ).slice(0, limit);
    return envelope(this.providerId, 'drug_reference', results, this.clock);
  }

  searchDevices(query: string, limit: number): ProviderObservationEnvelope<readonly MedicalDeviceReference[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_DEVICES.filter((d) => d.deviceName.toLowerCase().includes(q)).slice(0, limit);
    return envelope(this.providerId, 'medical_device_reference', results, this.clock);
  }
}

export class NppesFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'nppes' as const;
  readonly capabilities = Object.freeze(['healthcare_provider_reference', 'health_reference']);

  searchHealthcareProviders(query: string, limit: number): ProviderObservationEnvelope<readonly HealthcareProviderDirectoryEntry[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_HEALTHCARE_PROVIDERS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.providerIdentifier.includes(q),
    ).slice(0, limit);
    return envelope(this.providerId, 'healthcare_provider_reference', results, this.clock);
  }
}

export class ClinicalTrialsGovFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'clinicaltrials-gov' as const;
  readonly capabilities = Object.freeze(['clinical_trials', 'health_reference']);

  searchClinicalTrials(query: string, limit: number): ProviderObservationEnvelope<readonly ClinicalTrialObservation[]> {
    const q = query.toLowerCase();
    const results = FIXTURE_CLINICAL_TRIALS.filter(
      (t) => t.title.toLowerCase().includes(q) || t.trialId.toLowerCase().includes(q),
    ).slice(0, limit);
    return envelope(this.providerId, 'clinical_trials', results, this.clock);
  }
}

export class NhsScotlandFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'nhs-scotland-open-data' as const;
  readonly capabilities = Object.freeze(['public_health', 'health_reference']);

  searchPublicHealth(_query: string, limit: number): ProviderObservationEnvelope<readonly PublicHealthReference[]> {
    const results = FIXTURE_PUBLIC_HEALTH.filter((p) => p.providerId === this.providerId).slice(0, limit);
    return envelope(this.providerId, 'public_health', results, this.clock);
  }
}

export class HdxHealthFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'hdx-health' as const;
  readonly capabilities = Object.freeze(['public_health', 'health_reference']);

  searchPublicHealth(_query: string, limit: number): ProviderObservationEnvelope<readonly PublicHealthReference[]> {
    const results = FIXTURE_PUBLIC_HEALTH.filter((p) => p.providerId === this.providerId).slice(0, limit);
    return envelope(this.providerId, 'public_health', results, this.clock);
  }
}

export class LongevityWorldCupFixtureProvider extends BaseFixtureHealthProvider {
  readonly providerId = 'longevity-world-cup' as const;
  readonly capabilities = Object.freeze(['wellness_reference', 'health_reference']);

  searchWellness(_query: string, limit: number): ProviderObservationEnvelope<readonly WellnessReference[]> {
    const results = FIXTURE_WELLNESS.slice(0, limit);
    return envelope(this.providerId, 'wellness_reference', results, this.clock);
  }
}

export type Wave6FixtureProviders = Readonly<Record<HealthAdapterId, HealthProvider>>;

export function createWave6FixtureProviders(clock?: Clock): Wave6FixtureProviders {
  const c = clock ?? defaultClock();
  return Object.freeze({
    'open-food-facts': new OpenFoodFactsFixtureProvider(c),
    'usda-fooddata-central': new UsdaFoodDataCentralFixtureProvider(c),
    'medlineplus-genetics': new MedlinePlusGeneticsFixtureProvider(c),
    openfda: new OpenFdaFixtureProvider(c),
    nppes: new NppesFixtureProvider(c),
    'clinicaltrials-gov': new ClinicalTrialsGovFixtureProvider(c),
    'nhs-scotland-open-data': new NhsScotlandFixtureProvider(c),
    'hdx-health': new HdxHealthFixtureProvider(c),
    'longevity-world-cup': new LongevityWorldCupFixtureProvider(c),
  });
}
