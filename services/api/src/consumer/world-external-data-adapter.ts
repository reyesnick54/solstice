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
import { buildWorldSnapshot, type WorldSnapshot } from '../../../../packages/external-data/src/world-snapshot.ts';
import {
  buildProductiveEconomySnapshot,
  type ProductiveEconomySnapshot,
} from '../../../../packages/external-data/src/productive-economy-snapshot.ts';
import { DATA_MODE } from '../../../../packages/config/src/data-mode.ts';
import {
  defaultDataStateForMode,
  sanitizeSourceFromObservation,
} from '../../../../packages/external-data/src/product-data-state.ts';
import type { GrowContextSnapshot } from '../../../../packages/external-data/src/bridges.ts';

export type WorldExternalDataBff = {
  readonly economy: () => ReturnType<typeof worldEconomySnapshot>;
  readonly fx: () => {
    readonly schema: 'sunrey.bff.fx-reference.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly rates: readonly { readonly pair: string; readonly rate: string; readonly source: { readonly displayName: string } }[];
  };
  readonly markets: () => {
    readonly schema: 'sunrey.bff.market-reference.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly quotes: readonly { readonly symbol: string; readonly priceMinor: string; readonly source: { readonly displayName: string } }[];
    readonly commodities: readonly { readonly commodityId: string; readonly priceMinor: string }[];
  };
  readonly filings: () => {
    readonly schema: 'sunrey.bff.company-filings.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly filings: readonly {
      readonly companyName: string;
      readonly formType: string;
      readonly filingDate: string;
      readonly documentUrl: string;
    }[];
  };
  readonly regulatory: () => {
    readonly schema: 'sunrey.bff.regulatory-publications.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly publications: readonly { readonly title: string; readonly agency: string; readonly sourceUrl: string }[];
  };
  readonly growContext: () => ReturnType<typeof growContextSnapshot>;
  readonly growContextAsync: () => Promise<GrowContextSnapshot & { readonly dataState: ReturnType<typeof defaultDataStateForMode>; readonly dataMode: typeof DATA_MODE }>;
  readonly agentEvidence: () => ReturnType<typeof agentEvidenceSnapshot>;
  readonly exchangeReference: () => ReturnType<typeof exchangeReferenceSnapshot>;
  readonly moonReyContext: () => ReturnType<typeof moonReyResourceContext>;
  readonly moonReyContextAsync: () => Promise<ReturnType<typeof moonReyResourceContextAsync>>;
  readonly energy: () => Promise<{
    readonly schema: 'sunrey.bff.energy-observations.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly observations: readonly {
      readonly measurementKind: string;
      readonly value: number;
      readonly unit: string;
      readonly geography: string;
      readonly source: { readonly displayName: string };
    }[];
  }>;
  readonly resources: () => Promise<{
    readonly schema: 'sunrey.bff.resource-observations.v1';
    readonly dataState: ReturnType<typeof defaultDataStateForMode>;
    readonly dataMode: typeof DATA_MODE;
    readonly observations: readonly {
      readonly resourceType: string;
      readonly measurementType: string;
      readonly value: number | null;
      readonly unit: string | null;
      readonly geography: string | null;
      readonly status: ReturnType<typeof defaultDataStateForMode>;
    }[];
  }>;
  readonly worldSnapshot: () => Promise<WorldSnapshot>;
  readonly productiveEconomySnapshot: () => Promise<ProductiveEconomySnapshot>;
  readonly providerHealth: () => ReturnType<ExternalDataPlane['health']>;
  readonly coverage: () => ReturnType<ExternalDataPlane['coverageReport']>;
};

const RESOURCE_TYPES = Object.freeze(['gold', 'silver', 'copper', 'lithium', 'water', 'hydrogen', 'energy']);

export function createWorldExternalDataBff(plane: ExternalDataPlane): WorldExternalDataBff {
  return Object.freeze({
    economy: () => worldEconomySnapshot(plane),
    fx: () => {
      const result = plane.fx.getRates();
      const hasData = result.observations.length > 0;
      return Object.freeze({
        schema: 'sunrey.bff.fx-reference.v1',
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
        rates: Object.freeze(
          result.observations.map((o) => ({
            pair: `${o.data.baseCurrency}/${o.data.quoteCurrency}`,
            rate: o.data.rate,
            source: Object.freeze({
              displayName: sanitizeSourceFromObservation(o).displayName,
            }),
          })),
        ),
      });
    },
    markets: () => {
      const quotes = plane.markets.getQuotes();
      const commodities = plane.markets.getCommodities();
      const hasData = quotes.observations.length > 0 || commodities.observations.length > 0;
      return Object.freeze({
        schema: 'sunrey.bff.market-reference.v1',
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
        quotes: Object.freeze(
          quotes.observations.map((o) => ({
            symbol: o.data.symbol,
            priceMinor: o.data.priceMinor.toString(),
            source: Object.freeze({
              displayName: sanitizeSourceFromObservation(o).displayName,
            }),
          })),
        ),
        commodities: Object.freeze(
          commodities.observations.map((o) => ({
            commodityId: o.data.commodityId,
            priceMinor: o.data.priceMinor.toString(),
          })),
        ),
      });
    },
    filings: () => {
      const result = plane.company.getLatestFilings(20);
      const hasData = result.observations.length > 0;
      return Object.freeze({
        schema: 'sunrey.bff.company-filings.v1',
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
        filings: Object.freeze(
          result.observations.map((o) => ({
            companyName: o.data.companyName,
            formType: o.data.formType,
            filingDate: o.data.filingDate,
            documentUrl: o.data.documentUrl,
          })),
        ),
      });
    },
    regulatory: () => {
      const result = plane.company.getRegulatoryPublications();
      const hasData = result.observations.length > 0;
      return Object.freeze({
        schema: 'sunrey.bff.regulatory-publications.v1',
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
        publications: Object.freeze(
          result.observations.map((o) => ({
            title: o.data.title,
            agency: o.data.agency,
            sourceUrl: o.data.sourceUrl,
          })),
        ),
      });
    },
    growContext: () => growContextSnapshot(plane),
    growContextAsync: async () => {
      const snapshot = await growContextSnapshotAsync(plane);
      const hasData =
        snapshot.macroContext.length > 0 ||
        snapshot.marketContext.length > 0 ||
        snapshot.latestFilings.length > 0;
      return Object.freeze({
        ...snapshot,
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
      });
    },
    agentEvidence: () => agentEvidenceSnapshot(plane),
    exchangeReference: () => exchangeReferenceSnapshot(plane),
    moonReyContext: () => moonReyResourceContext(plane),
    moonReyContextAsync: () => moonReyResourceContextAsync(plane),
    energy: async () => {
      const world = await worldEconomySnapshotAsync(plane);
      const hasData = world.energy.length > 0;
      return Object.freeze({
        schema: 'sunrey.bff.energy-observations.v1',
        dataState: defaultDataStateForMode(hasData),
        dataMode: DATA_MODE,
        observations: Object.freeze(
          world.energy.map((o) => ({
            measurementKind: o.measurementKind,
            value: o.value,
            unit: o.unit,
            geography: o.geography,
            source: Object.freeze({ displayName: o.providerId }),
          })),
        ),
      });
    },
    resources: async () => {
      const world = await worldEconomySnapshotAsync(plane);
      const availability = plane.productiveEconomy.runtime.index.resources.resourceAvailability();
      const byType = new Map(world.resources.map((o) => [o.resourceType.toLowerCase(), o]));
      const observations = RESOURCE_TYPES.map((resourceType) => {
        const row = byType.get(resourceType);
        const avail = availability.find((a) => a.resourceType.toLowerCase() === resourceType);
        if (!row || avail?.status === 'NO_ELIGIBLE_LIVE_SOURCE') {
          return Object.freeze({
            resourceType,
            measurementType: row?.measurementType ?? 'PRICE',
            value: null,
            unit: null,
            geography: null,
            status: 'UNAVAILABLE' as const,
          });
        }
        return Object.freeze({
          resourceType,
          measurementType: row.measurementType,
          value: row.value,
          unit: row.unit,
          geography: row.geography,
          status: defaultDataStateForMode(true),
        });
      });
      const hasAny = observations.some((o) => o.status !== 'UNAVAILABLE');
      return Object.freeze({
        schema: 'sunrey.bff.resource-observations.v1',
        dataState: hasAny
          ? observations.some((o) => o.status === 'UNAVAILABLE')
            ? 'PARTIAL'
            : defaultDataStateForMode(true)
          : 'UNAVAILABLE',
        dataMode: DATA_MODE,
        observations,
      });
    },
    worldSnapshot: () => buildWorldSnapshot(plane),
    productiveEconomySnapshot: () => buildProductiveEconomySnapshot(plane),
    providerHealth: () => plane.health(),
    coverage: () => plane.coverageReport(),
  });
}
