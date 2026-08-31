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
  growContextSnapshotAsync,
  moonReyResourceContext,
  moonReyResourceContextAsync,
  worldEconomySnapshot,
  worldEconomySnapshotAsync,
} from '../../../../packages/external-data/src/bridges.ts';

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
  readonly energy: () => Promise<{
    readonly schema: 'sunrey.bff.energy-observations.v1';
    readonly observations: readonly {
      readonly providerId: string;
      readonly measurementKind: string;
      readonly value: number;
      readonly unit: string;
      readonly geography: string;
    }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  }>;
  readonly resources: () => Promise<{
    readonly schema: 'sunrey.bff.resource-observations.v1';
    readonly observations: readonly {
      readonly resourceType: string;
      readonly measurementType: string;
      readonly value: number;
      readonly unit: string;
      readonly geography: string;
      readonly status: 'AVAILABLE' | 'UNAVAILABLE' | 'NO_ELIGIBLE_LIVE_SOURCE';
    }[];
    readonly availability: 'AVAILABLE_SIMULATION';
  }>;
  readonly providerHealth: () => ReturnType<ExternalDataPlane['health']>;
  readonly coverage: () => ReturnType<ExternalDataPlane['coverageReport']>;
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
    energy: async () => {
      const world = await worldEconomySnapshotAsync(plane);
      return Object.freeze({
        schema: 'sunrey.bff.energy-observations.v1',
        observations: world.energy,
        availability: 'AVAILABLE_SIMULATION',
      });
    },
    resources: async () => {
      const world = await worldEconomySnapshotAsync(plane);
      const availability = plane.productiveEconomy.runtime.index.resources.resourceAvailability();
      return Object.freeze({
        schema: 'sunrey.bff.resource-observations.v1',
        observations: Object.freeze(
          world.resources.map((o) => ({
            ...o,
            status: 'AVAILABLE' as const,
          })),
        ),
        availability: 'AVAILABLE_SIMULATION',
        catalogAvailability: availability,
      });
    },
    providerHealth: () => plane.health(),
    coverage: () => plane.coverageReport(),
  });
}
