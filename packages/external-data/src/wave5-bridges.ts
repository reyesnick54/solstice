/**
 * Wave 5 product integration bridges — World, MoonRey, Travel, Grow, Agent.
 */

import type { ExternalDataPlane } from './plane.ts';
import type { Wave5Services } from './wave5-services.ts';

export type WorldPhysicalEconomySnapshot = {
  readonly schema: 'sunrey.world.physical-economy.v1';
  readonly energy: readonly { readonly metricId: string; readonly value: number; readonly unit: string }[];
  readonly resources: readonly { readonly resourceId: string; readonly name: string; readonly unit: string }[];
  readonly weather: readonly { readonly locationId: string; readonly condition: string; readonly temperatureCelsius: number | null }[];
  readonly environment: readonly { readonly metricId: string; readonly value: number; readonly unit: string }[];
  readonly transportation: readonly { readonly routeId: string; readonly routeName: string; readonly status: string }[];
  readonly maritime: readonly { readonly corridor: string; readonly vesselCount: number | null }[];
  readonly geospatial: readonly { readonly locationId: string; readonly country: string; readonly city: string | null }[];
  readonly availability: 'AVAILABLE_SIMULATION' | 'DEGRADED';
  readonly grantsExecutionAuthority: false;
};

export type MoonReyProductiveEconomySnapshot = {
  readonly schema: 'sunrey.moonrey.productive-economy.v1';
  readonly energyMetrics: readonly { readonly metricId: string; readonly value: number; readonly unit: string }[];
  readonly resourceMetrics: readonly { readonly resourceId: string; readonly productionQuantity: number | null; readonly unit: string }[];
  readonly logisticsMetrics: readonly { readonly observationType: string; readonly status: string }[];
  readonly maritimeFlow: readonly { readonly corridor: string; readonly cargoType: string | null }[];
  readonly issuanceAuthority: false;
  readonly mintsMoonRey: false;
};

export type TravelContextSnapshot = {
  readonly schema: 'sunrey.travel.context.v1';
  readonly weather: readonly { readonly locationId: string; readonly condition: string; readonly temperatureCelsius: number | null }[];
  readonly aviation: readonly { readonly callsign: string | null; readonly origin: string | null; readonly destination: string | null }[];
  readonly transit: readonly { readonly routeName: string; readonly mode: string; readonly status: string }[];
  readonly geography: readonly { readonly locationId: string; readonly displayName: string }[];
  readonly grantsExecutionAuthority: false;
};

export type RealEstateContextSnapshot = {
  readonly schema: 'sunrey.real-estate.context.v1';
  readonly locations: readonly {
    readonly locationId: string;
    readonly country: string;
    readonly region: string | null;
    readonly coordinates: { readonly latitude: number | null; readonly longitude: number | null };
    readonly elevationMeters: number | null;
    readonly classification: string;
  }[];
  readonly environmentalContext: readonly { readonly metricId: string; readonly value: number; readonly unit: string }[];
  readonly grantsPricingAuthority: false;
};

export function worldPhysicalEconomySnapshot(plane: ExternalDataPlane): WorldPhysicalEconomySnapshot {
  const w5 = plane.wave5;
  const energy = w5.energy.getObservations();
  const resources = w5.resources.getObservations();
  const weather = w5.weather.getCurrentWeather();
  const environment = w5.environment.getObservations();
  const transit = w5.travel.getTransitRoutes();
  const maritime = w5.maritime.getShippingFlow();
  const geocoded = w5.geospatial.geocode('London');

  const degraded =
    energy.degraded || weather.degraded || environment.degraded || transit.degraded || maritime.degraded;

  return Object.freeze({
    schema: 'sunrey.world.physical-economy.v1',
    energy: Object.freeze(
      energy.observations.map((o) => ({
        metricId: o.data.metricId,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    resources: Object.freeze(
      resources.observations.map((o) => ({
        resourceId: o.data.resourceId,
        name: o.data.name,
        unit: o.data.unit,
      })),
    ),
    weather: Object.freeze(
      weather.observations.map((o) => ({
        locationId: o.data.locationId,
        condition: o.data.condition,
        temperatureCelsius: o.data.temperatureCelsius,
      })),
    ),
    environment: Object.freeze(
      environment.observations.map((o) => ({
        metricId: o.data.metricId,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    transportation: Object.freeze(
      transit.observations.map((o) => ({
        routeId: o.data.routeId,
        routeName: o.data.routeName,
        status: o.data.status,
      })),
    ),
    maritime: Object.freeze(
      maritime.observations.map((o) => ({
        corridor: o.data.corridor,
        vesselCount: o.data.vesselCount,
      })),
    ),
    geospatial: Object.freeze(
      geocoded.observations.map((o) => ({
        locationId: o.data.locationId,
        country: o.data.geography.country,
        city: o.data.geography.city,
      })),
    ),
    availability: degraded ? 'DEGRADED' : 'AVAILABLE_SIMULATION',
    grantsExecutionAuthority: false,
  });
}

export function moonReyProductiveEconomySnapshot(plane: ExternalDataPlane): MoonReyProductiveEconomySnapshot {
  const w5 = plane.wave5;
  const energy = w5.energy.getObservations();
  const resources = w5.resources.getObservations();
  const logistics = w5.logistics.getObservations();
  const maritime = w5.maritime.getShippingFlow();

  return Object.freeze({
    schema: 'sunrey.moonrey.productive-economy.v1',
    energyMetrics: Object.freeze(
      energy.observations.map((o) => ({
        metricId: o.data.metricId,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    resourceMetrics: Object.freeze(
      resources.observations.map((o) => ({
        resourceId: o.data.resourceId,
        productionQuantity: o.data.productionQuantity,
        unit: o.data.unit,
      })),
    ),
    logisticsMetrics: Object.freeze(
      logistics.observations.map((o) => ({
        observationType: o.data.observationType,
        status: o.data.status,
      })),
    ),
    maritimeFlow: Object.freeze(
      maritime.observations.map((o) => ({
        corridor: o.data.corridor,
        cargoType: o.data.cargoType,
      })),
    ),
    issuanceAuthority: false,
    mintsMoonRey: false,
  });
}

export function travelContextSnapshot(plane: ExternalDataPlane): TravelContextSnapshot {
  const w5 = plane.wave5;
  const weather = w5.weather.getCurrentWeather();
  const aviation = w5.travel.getAviationPositions();
  const transit = w5.travel.getTransitRoutes();
  const geocoded = w5.geospatial.geocode('London');

  return Object.freeze({
    schema: 'sunrey.travel.context.v1',
    weather: Object.freeze(
      weather.observations.map((o) => ({
        locationId: o.data.locationId,
        condition: o.data.condition,
        temperatureCelsius: o.data.temperatureCelsius,
      })),
    ),
    aviation: Object.freeze(
      aviation.observations.map((o) => ({
        callsign: o.data.callsign,
        origin: o.data.origin,
        destination: o.data.destination,
      })),
    ),
    transit: Object.freeze(
      transit.observations.map((o) => ({
        routeName: o.data.routeName,
        mode: o.data.mode,
        status: o.data.status,
      })),
    ),
    geography: Object.freeze(
      geocoded.observations.map((o) => ({
        locationId: o.data.locationId,
        displayName: o.data.displayName,
      })),
    ),
    grantsExecutionAuthority: false,
  });
}

export function realEstateContextSnapshot(plane: ExternalDataPlane): RealEstateContextSnapshot {
  const w5 = plane.wave5;
  const geocoded = w5.geospatial.geocode('Springfield, Illinois');
  const elevation = w5.geospatial.getElevation(39.7817, -89.6501);
  const environment = w5.environment.getObservations();

  return Object.freeze({
    schema: 'sunrey.real-estate.context.v1',
    locations: Object.freeze(
      geocoded.observations.map((o) => ({
        locationId: o.data.locationId,
        country: o.data.geography.country,
        region: o.data.geography.region,
        coordinates: Object.freeze({
          latitude: o.data.geography.latitude,
          longitude: o.data.geography.longitude,
        }),
        elevationMeters: elevation.observations[0]?.data.elevationMeters ?? null,
        classification: elevation.observations[0]?.data.classification ?? 'UNKNOWN',
      })),
    ),
    environmentalContext: Object.freeze(
      environment.observations.map((o) => ({
        metricId: o.data.metricId,
        value: o.data.value,
        unit: o.data.unit,
      })),
    ),
    grantsPricingAuthority: false,
  });
}

export function growPhysicalContextSnapshot(plane: ExternalDataPlane) {
  const w5 = plane.wave5;
  const energy = w5.energy.getObservations();
  const resources = w5.resources.getObservations();
  return Object.freeze({
    schema: 'sunrey.grow.physical-context.v1' as const,
    energyAvailable: energy.observations.length > 0,
    resourcesAvailable: resources.observations.length > 0,
    grantsExecutionAuthority: false as const,
  });
}

export function agentPhysicalEvidenceSnapshot(plane: ExternalDataPlane) {
  const w5 = plane.wave5;
  const observations = [
    ...w5.energy.getObservations().observations,
    ...w5.weather.getCurrentWeather().observations,
    ...w5.geospatial.getCountries().observations,
  ];
  return Object.freeze({
    schema: 'sunrey.agent.physical-evidence.v1' as const,
    evidenceCount: observations.length,
    grantsExecutionAuthority: false as const,
  });
}

export type { Wave5Services };
