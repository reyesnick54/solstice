/**
 * Consumer BFF adapter for Wave 2 external reference data.
 *
 * Vendor-independent. No credentials. No user-controlled provider URLs.
 */

import type { ExternalDataPlane } from '../../../../packages/external-data/src/plane.ts';
import {
  agentEvidenceSnapshot,
  exchangeReferenceSnapshot,
  growContextSnapshot,
  moonReyResourceContext,
  worldEconomySnapshot,
} from '../../../../packages/external-data/src/bridges.ts';
import {
  agentPhysicalEvidenceSnapshot,
  growPhysicalContextSnapshot,
  moonReyProductiveEconomySnapshot,
  realEstateContextSnapshot,
  travelContextSnapshot,
  worldPhysicalEconomySnapshot,
} from '../../../../packages/external-data/src/wave5-bridges.ts';
import { buildProductiveEconomicGraph } from '../../../../packages/external-data/src/wave5-peg.ts';

export type WorldExternalDataBff = {
  readonly economy: () => ReturnType<typeof worldEconomySnapshot>;
  readonly fx: () => {
    readonly schema: 'sunrey.bff.fx-reference.v1';
    readonly rates: readonly { readonly pair: string; readonly rate: string; readonly providerId: string }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  };
  readonly markets: () => {
    readonly schema: 'sunrey.bff.market-reference.v1';
    readonly quotes: readonly { readonly symbol: string; readonly priceMinor: string; readonly providerId: string }[];
    readonly commodities: readonly { readonly commodityId: string; readonly priceMinor: string }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  };
  readonly filings: () => {
    readonly schema: 'sunrey.bff.company-filings.v1';
    readonly filings: readonly {
      readonly companyName: string;
      readonly formType: string;
      readonly filingDate: string;
      readonly documentUrl: string;
    }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  };
  readonly regulatory: () => {
    readonly schema: 'sunrey.bff.regulatory-publications.v1';
    readonly publications: readonly { readonly title: string; readonly agency: string; readonly sourceUrl: string }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  };
  readonly growContext: () => ReturnType<typeof growContextSnapshot>;
  readonly agentEvidence: () => ReturnType<typeof agentEvidenceSnapshot>;
  readonly exchangeReference: () => ReturnType<typeof exchangeReferenceSnapshot>;
  readonly moonReyContext: () => ReturnType<typeof moonReyResourceContext>;
  readonly providerHealth: () => ReturnType<ExternalDataPlane['health']>;
  readonly coverage: () => ReturnType<ExternalDataPlane['coverageReport']>;
  readonly physicalEconomy: () => ReturnType<typeof worldPhysicalEconomySnapshot>;
  readonly travelContext: () => ReturnType<typeof travelContextSnapshot>;
  readonly moonReyProductiveEconomy: () => ReturnType<typeof moonReyProductiveEconomySnapshot>;
  readonly realEstateContext: () => ReturnType<typeof realEstateContextSnapshot>;
  readonly productiveEconomicGraph: () => ReturnType<typeof buildProductiveEconomicGraph>;
  readonly providerRisk: () => ReturnType<ExternalDataPlane['providerRisk']['snapshot']>;
  readonly wave5Coverage: () => ReturnType<ExternalDataPlane['wave5CoverageReport']>;
  readonly geospatial: () => {
    readonly schema: 'sunrey.bff.geospatial.v1';
    readonly countries: readonly { readonly countryCode: string; readonly name: string }[];
    readonly geocoded: readonly { readonly locationId: string; readonly displayName: string }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  };
  readonly energy: () => {
    readonly schema: 'sunrey.bff.energy.v1';
    readonly metrics: readonly { readonly metricId: string; readonly value: number; readonly unit: string }[];
    readonly availability: 'AVAILABLE_SIMULATION' | 'DEGRADED';
  };
  readonly weather: () => {
    readonly schema: 'sunrey.bff.weather.v1';
    readonly observations: readonly { readonly locationId: string; readonly condition: string; readonly temperatureCelsius: number | null }[];
    readonly availability: 'AVAILABLE_SIMULATION' | 'DEGRADED';
  };
  readonly maritime: () => {
    readonly schema: 'sunrey.bff.maritime.v1';
    readonly shippingFlow: readonly { readonly corridor: string; readonly vesselCount: number | null }[];
    readonly availability: 'AVAILABLE_SIMULATION' | 'DEGRADED';
  };
  readonly logistics: () => {
    readonly schema: 'sunrey.bff.logistics.v1';
    readonly observations: readonly { readonly observationType: string; readonly status: string }[];
    readonly availability: 'AVAILABLE_SIMULATION' | 'DEGRADED';
  };
};

export function createWorldExternalDataBff(plane: ExternalDataPlane): WorldExternalDataBff {
  return Object.freeze({
    economy: () => worldEconomySnapshot(plane),
    fx: () => {
      const result = plane.fx.getRates();
      return Object.freeze({
        schema: 'sunrey.bff.fx-reference.v1',
        rates: Object.freeze(
          result.observations.map((o) => ({
            pair: `${o.data.baseCurrency}/${o.data.quoteCurrency}`,
            rate: o.data.rate,
            providerId: o.providerId,
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    markets: () => {
      const quotes = plane.markets.getQuotes();
      const commodities = plane.markets.getCommodities();
      return Object.freeze({
        schema: 'sunrey.bff.market-reference.v1',
        quotes: Object.freeze(
          quotes.observations.map((o) => ({
            symbol: o.data.symbol,
            priceMinor: o.data.priceMinor.toString(),
            providerId: o.providerId,
          })),
        ),
        commodities: Object.freeze(
          commodities.observations.map((o) => ({
            commodityId: o.data.commodityId,
            priceMinor: o.data.priceMinor.toString(),
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    filings: () => {
      const result = plane.company.getLatestFilings(20);
      return Object.freeze({
        schema: 'sunrey.bff.company-filings.v1',
        filings: Object.freeze(
          result.observations.map((o) => ({
            companyName: o.data.companyName,
            formType: o.data.formType,
            filingDate: o.data.filingDate,
            documentUrl: o.data.documentUrl,
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    regulatory: () => {
      const result = plane.company.getRegulatoryPublications();
      return Object.freeze({
        schema: 'sunrey.bff.regulatory-publications.v1',
        publications: Object.freeze(
          result.observations.map((o) => ({
            title: o.data.title,
            agency: o.data.agency,
            sourceUrl: o.data.sourceUrl,
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    growContext: () => growContextSnapshot(plane),
    agentEvidence: () => agentEvidenceSnapshot(plane),
    exchangeReference: () => exchangeReferenceSnapshot(plane),
    moonReyContext: () => moonReyResourceContext(plane),
    providerHealth: () => plane.health(),
    coverage: () => plane.coverageReport(),
    physicalEconomy: () => worldPhysicalEconomySnapshot(plane),
    travelContext: () => travelContextSnapshot(plane),
    moonReyProductiveEconomy: () => moonReyProductiveEconomySnapshot(plane),
    realEstateContext: () => realEstateContextSnapshot(plane),
    productiveEconomicGraph: () => buildProductiveEconomicGraph(plane),
    providerRisk: () => plane.providerRisk.snapshot(),
    wave5Coverage: () => plane.wave5CoverageReport(),
    geospatial: () => {
      const countries = plane.wave5.geospatial.getCountries();
      const geocoded = plane.wave5.geospatial.geocode('London');
      return Object.freeze({
        schema: 'sunrey.bff.geospatial.v1',
        countries: Object.freeze(
          countries.observations.map((o) => ({
            countryCode: o.data.countryCode,
            name: o.data.name,
          })),
        ),
        geocoded: Object.freeze(
          geocoded.observations.map((o) => ({
            locationId: o.data.locationId,
            displayName: o.data.displayName,
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    energy: () => {
      const result = plane.wave5.energy.getObservations();
      return Object.freeze({
        schema: 'sunrey.bff.energy.v1',
        metrics: Object.freeze(
          result.observations.map((o) => ({
            metricId: o.data.metricId,
            value: o.data.value,
            unit: o.data.unit,
          })),
        ),
        availability: result.degraded ? 'DEGRADED' : 'AVAILABLE_SIMULATION',
      });
    },
    weather: () => {
      const result = plane.wave5.weather.getCurrentWeather();
      return Object.freeze({
        schema: 'sunrey.bff.weather.v1',
        observations: Object.freeze(
          result.observations.map((o) => ({
            locationId: o.data.locationId,
            condition: o.data.condition,
            temperatureCelsius: o.data.temperatureCelsius,
          })),
        ),
        availability: result.degraded ? 'DEGRADED' : 'AVAILABLE_SIMULATION',
      });
    },
    maritime: () => {
      const result = plane.wave5.maritime.getShippingFlow();
      return Object.freeze({
        schema: 'sunrey.bff.maritime.v1',
        shippingFlow: Object.freeze(
          result.observations.map((o) => ({
            corridor: o.data.corridor,
            vesselCount: o.data.vesselCount,
          })),
        ),
        availability: result.degraded ? 'DEGRADED' : 'AVAILABLE_SIMULATION',
      });
    },
    logistics: () => {
      const result = plane.wave5.logistics.getObservations();
      return Object.freeze({
        schema: 'sunrey.bff.logistics.v1',
        observations: Object.freeze(
          result.observations.map((o) => ({
            observationType: o.data.observationType,
            status: o.data.status,
          })),
        ),
        availability: result.degraded ? 'DEGRADED' : 'AVAILABLE_SIMULATION',
      });
    },
  });
}
