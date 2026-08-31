/**
 * Wave 5 Prompt 18 — productive economic observation models.
 *
 * Observations only. External data does not mint MoonRey or change balances.
 */

import type { AuthorityClass, ExternalObservation } from '../../../provider-sdk/src/index.ts';

export const PRODUCTIVE_ECONOMIC_OBSERVATION_SCHEMA = 'sunrey.productive-economic-observation.v1' as const;
export const ENERGY_OBSERVATION_SCHEMA = 'sunrey.energy-observation.v1' as const;
export const RESOURCE_OBSERVATION_SCHEMA = 'sunrey.resource-observation.v1' as const;

export const ECONOMIC_DOMAINS = [
  'ENERGY',
  'ELECTRICITY',
  'RESOURCE',
  'AGRICULTURE',
  'INDUSTRIAL_OUTPUT',
  'CARBON',
  'TRANSPORT',
  'COMPUTE',
  'WATER',
  'REAL_ESTATE',
  'FOOD',
  'LOGISTICS',
] as const;
export type EconomicDomain = (typeof ECONOMIC_DOMAINS)[number];

export const ENERGY_SOURCE_TYPES = [
  'SOLAR',
  'WIND',
  'HYDRO',
  'NUCLEAR',
  'COAL',
  'NATURAL_GAS',
  'OIL',
  'BIOMASS',
  'GEOTHERMAL',
  'HYDROGEN',
  'BATTERY_STORAGE',
  'OTHER',
] as const;
export type EnergySourceType = (typeof ENERGY_SOURCE_TYPES)[number];

export const RESOURCE_MEASUREMENT_TYPES = [
  'PRICE',
  'PRODUCTION',
  'RESERVES',
  'CONSUMPTION',
  'FLOW',
  'INVENTORY',
  'CAPACITY',
  'YIELD',
  'CARBON_INTENSITY',
] as const;
export type ResourceMeasurementType = (typeof RESOURCE_MEASUREMENT_TYPES)[number];

export const RESOURCE_TYPES = [
  'GOLD',
  'SILVER',
  'COPPER',
  'LITHIUM',
  'WATER',
  'HYDROGEN',
  'OIL',
  'NATURAL_GAS',
  'WHEAT',
  'RICE',
  'CORN',
  'SOYBEAN',
  'COTTON',
  'SUGAR',
  'CARBON_OFFSET',
  'OTHER',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export type GeographicIdentity = {
  readonly country: string;
  readonly region: string | null;
  readonly gridZone: string | null;
  readonly balancingAuthority: string | null;
  readonly marketArea: string | null;
  readonly facility: string | null;
  readonly coordinates: { readonly lat: number; readonly lon: number } | null;
};

export type UnitNormalization = {
  readonly sourceValue: number;
  readonly sourceUnit: string;
  readonly normalizedValue: number;
  readonly normalizedUnit: string;
  readonly conversionMethod: string;
  readonly conversionVersion: string;
};

export type ObservationFreshness = {
  readonly state: 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED';
  readonly ageSeconds: number;
  readonly maxAgeSeconds: number;
};

export type ProductiveEconomicObservation = {
  readonly schema: typeof PRODUCTIVE_ECONOMIC_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly economicDomain: EconomicDomain;
  readonly resourceType: ResourceType | null;
  readonly assetId: string | null;
  readonly geography: GeographicIdentity;
  readonly jurisdiction: string;
  readonly value: number;
  readonly unit: string;
  readonly currency: string | null;
  readonly effectiveAt: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly providerId: string;
  readonly freshness: ObservationFreshness;
  readonly confidence: number;
  readonly authorityClass: AuthorityClass;
  readonly provenance: string;
  readonly unitNormalization: UnitNormalization;
  readonly mintsMoonRey: false;
  readonly issuanceAuthority: false;
};

export type EnergyObservation = {
  readonly schema: typeof ENERGY_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly economicDomain: 'ENERGY' | 'ELECTRICITY' | 'CARBON';
  readonly measurementKind:
    | 'GENERATION'
    | 'DEMAND'
    | 'LOAD'
    | 'PRICE'
    | 'GENERATION_MIX'
    | 'RENEWABLE_SHARE'
    | 'CARBON_INTENSITY'
    | 'GRID_FREQUENCY'
    | 'IMPORT'
    | 'EXPORT'
    | 'PRODUCTION'
    | 'CONSUMPTION'
    | 'CAPACITY';
  readonly energySource: EnergySourceType | null;
  readonly providerNativeSource: string | null;
  readonly geography: GeographicIdentity;
  readonly value: number;
  readonly unit: string;
  readonly currency: string | null;
  readonly effectiveAt: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly providerId: string;
  readonly freshness: ObservationFreshness;
  readonly confidence: number;
  readonly authorityClass: AuthorityClass;
  readonly provenance: string;
  readonly unitNormalization: UnitNormalization;
  readonly mintsMoonRey: false;
};

export type ResourceObservation = {
  readonly schema: typeof RESOURCE_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly resourceType: ResourceType;
  readonly measurementType: ResourceMeasurementType;
  readonly geography: GeographicIdentity;
  readonly value: number;
  readonly unit: string;
  readonly currency: string | null;
  readonly effectiveAt: string;
  readonly sourceTimestamp: string;
  readonly retrievedAt: string;
  readonly providerId: string;
  readonly freshness: ObservationFreshness;
  readonly confidence: number;
  readonly authorityClass: AuthorityClass;
  readonly provenance: string;
  readonly unitNormalization: UnitNormalization;
  readonly mintsMoonRey: false;
};

export type ProductiveEconomicExternalObservation =
  | ExternalObservation<EnergyObservation>
  | ExternalObservation<ResourceObservation>
  | ExternalObservation<ProductiveEconomicObservation>;

export type Wave5ProviderClassification =
  | 'PRODUCTION_CANDIDATE'
  | 'PREVIEW_ONLY'
  | 'BLOCKED'
  | 'DEPRECATED'
  | 'UNAVAILABLE';

export type Wave5ProviderCoverage = {
  readonly providerId: string;
  readonly classification: Wave5ProviderClassification;
  readonly category: string;
  readonly capabilities: readonly string[];
  readonly geographicScope: readonly string[];
  readonly notes: string;
};

export type ResourceAvailability = {
  readonly resourceType: ResourceType;
  readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'NO_ELIGIBLE_LIVE_SOURCE';
  readonly providerId: string | null;
  readonly notes: string;
};
