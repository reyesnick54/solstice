/**
 * Travel product BFF — canonical travel intelligence aggregation.
 *
 * Reference/planning only. No booking confirmation or execution authority.
 */

import type { EnvironmentalOracleBff } from './environmental-adapter.ts';
import type { WorldExternalDataBff } from './world-external-data-adapter.ts';
import { DATA_MODE } from '../../../../packages/config/src/data-mode.ts';
import {
  aggregateOverallState,
  buildSectionEnvelope,
  defaultDataStateForMode,
  type ProductDataState,
} from '../../../../packages/external-data/src/product-data-state.ts';

export type TravelSnapshot = {
  readonly schema: 'sunrey.bff.travel.snapshot.v1';
  readonly generatedAt: string;
  readonly overallStatus: ProductDataState;
  readonly dataMode: typeof DATA_MODE;
  readonly referenceOnly: true;
  readonly bookingAuthorized: false;
  readonly sections: Readonly<{
    readonly destination: ReturnType<typeof buildSectionEnvelope<unknown>>;
    readonly weather: ReturnType<typeof buildSectionEnvelope<unknown>>;
    readonly environment: ReturnType<typeof buildSectionEnvelope<unknown>>;
    readonly currency: ReturnType<typeof buildSectionEnvelope<unknown>>;
    readonly mobility: ReturnType<typeof buildSectionEnvelope<unknown>>;
  }>;
};

export type TravelBff = {
  readonly overview: (query: TravelOverviewQuery) => Promise<TravelSnapshot>;
};

export type TravelOverviewQuery = {
  readonly originLat?: number | null;
  readonly originLon?: number | null;
  readonly destLat?: number;
  readonly destLon?: number;
  readonly destinationLabel?: string;
};

export function createTravelBff(input: {
  readonly environmental: EnvironmentalOracleBff;
  readonly world: WorldExternalDataBff;
  readonly nowUtc?: string;
}): TravelBff {
  const nowUtc = input.nowUtc ?? new Date().toISOString();
  const defaultDest = Object.freeze({ lat: 37.7749, lon: -122.4194 });

  return Object.freeze({
    async overview(query: TravelOverviewQuery): Promise<TravelSnapshot> {
      const destLat = query.destLat ?? defaultDest.lat;
      const destLon = query.destLon ?? defaultDest.lon;
      const originLat = query.originLat ?? null;
      const originLon = query.originLon ?? null;

      const [travelEnv, fx] = await Promise.allSettled([
        input.environmental.travelContext(originLat, originLon, destLat, destLon),
        Promise.resolve(input.world.fx()),
      ]);

      const envData = travelEnv.status === 'fulfilled' ? travelEnv.value : null;
      const fxData = fx.status === 'fulfilled' ? fx.value : null;

      const destination = buildSectionEnvelope({
        status: envData ? defaultDataStateForMode(true) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: envData ? 'current' : 'none',
        source: Object.freeze({ displayName: 'Travel Intelligence', authorityClass: 'reference_data' }),
        data: Object.freeze({
          label: query.destinationLabel ?? 'Destination',
          entryRequirements: null,
          referenceOnly: true,
        }),
      });

      const weather = buildSectionEnvelope({
        status: envData?.destination ? defaultDataStateForMode(true) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: envData ? 'current' : 'none',
        source: Object.freeze({ displayName: 'Environmental Oracle', authorityClass: 'reference_data' }),
        data: envData?.destination
          ? Object.freeze({
              summary: envData.destination.weather,
              airQuality: envData.destination.airQuality,
              severeConditions: envData.destination.severeConditions,
            })
          : null,
      });

      const environment = buildSectionEnvelope({
        status: envData ? defaultDataStateForMode(true) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: envData ? 'current' : 'none',
        source: Object.freeze({ displayName: 'Environmental Oracle', authorityClass: 'reference_data' }),
        data: envData,
      });

      const currency = buildSectionEnvelope({
        status: fxData && fxData.rates.length > 0 ? defaultDataStateForMode(true) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: fxData ? 'current' : 'none',
        source: Object.freeze({ displayName: 'FX Reference', authorityClass: 'reference_data' }),
        data: fxData
          ? Object.freeze({
              rates: fxData.rates.slice(0, 5),
            })
          : null,
      });

      const mobility = buildSectionEnvelope({
        status: envData?.destination?.aviationWeatherAvailable ? defaultDataStateForMode(true) : 'UNAVAILABLE',
        updatedAt: nowUtc,
        freshness: 'reference',
        source: Object.freeze({ displayName: 'Mobility Reference', authorityClass: 'reference_data' }),
        data: Object.freeze({
          airportContext: envData?.destination?.aviationWeatherAvailable ?? false,
          transit: null,
          charging: null,
          note: 'Transit and charging reference routes via /api/v1/access',
        }),
      });

      const sections = Object.freeze({ destination, weather, environment, currency, mobility });

      return Object.freeze({
        schema: 'sunrey.bff.travel.snapshot.v1',
        generatedAt: nowUtc,
        overallStatus: aggregateOverallState(Object.values(sections).map((s) => s.status)),
        dataMode: DATA_MODE,
        referenceOnly: true,
        bookingAuthorized: false,
        sections,
      });
    },
  });
}
