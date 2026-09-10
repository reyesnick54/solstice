/**
 * Open Charge Map API — EV charging infrastructure discovery.
 */

import { BaseLiveAccessAdapter, type BaseLiveAdapterDeps } from './base.ts';
import type { AccessLiveOffer, LiveProviderAdapterResult, LiveProviderSearchRequest } from '../types.ts';

type OcmStation = {
  readonly ID?: number;
  readonly AddressInfo?: {
    readonly Title?: string;
    readonly AddressLine1?: string;
    readonly Town?: string;
    readonly Country?: { readonly Title?: string; readonly ISOCode?: string };
    readonly Latitude?: number;
    readonly Longitude?: number;
  };
  readonly OperatorInfo?: { readonly Title?: string };
  readonly Connections?: readonly {
    readonly ConnectionType?: { readonly Title?: string };
    readonly PowerKW?: number;
    readonly Quantity?: number;
  }[];
  readonly UsageType?: { readonly Title?: string };
  readonly StatusType?: { readonly Title?: string };
  readonly GeneralComments?: string;
  readonly DateLastVerified?: string;
  readonly DateLastStatusUpdate?: string;
};

export class OpenChargeMapLiveAdapter extends BaseLiveAccessAdapter {
  constructor(deps: BaseLiveAdapterDeps = {}) {
    super(
      {
        providerId: 'open-charge-map',
        displayName: 'Open Charge Map',
        categories: Object.freeze(['TRANSPORTATION', 'ENERGY', 'VEHICLE_HOURS']),
        consumerCategories: Object.freeze(['MOBILITY', 'ENERGY']),
        authenticationType: 'OPTIONAL_API_KEY',
        termsClassification: 'FREE_PUBLIC',
        credentialEnvKey: 'OPEN_CHARGE_MAP_API_KEY',
        cacheTtlSeconds: 600,
      },
      deps,
    );
  }

  async search(request: LiveProviderSearchRequest): Promise<LiveProviderAdapterResult<readonly AccessLiveOffer[]>> {
    const params = new URLSearchParams({
      output: 'json',
      maxresults: String(Math.min(request.limit ?? 25, 100)),
    });
    if (this.envConfig.openChargeMapApiKey) {
      params.set('key', this.envConfig.openChargeMapApiKey);
    }
    if (request.latitude !== undefined && request.longitude !== undefined) {
      params.set('latitude', String(request.latitude));
      params.set('longitude', String(request.longitude));
      params.set('distance', String(request.radiusKm ?? 25));
      params.set('distanceunit', 'KM');
    } else if (request.country) {
      params.set('countrycode', request.country);
    }

    const cacheKey = `ocm:${params.toString()}`;
    return this.withCache(cacheKey, 600, async () => {
      const response = await this.http.requestJson<readonly OcmStation[]>({
        providerId: this.providerId,
        method: 'GET',
        url: `https://api.openchargemap.io/v3/poi/?${params.toString()}`,
      });

      if (!response.ok) {
        return this.fail(response.code, response.message);
      }

      const retrievedAt = this.nowUtc();
      const stations = Array.isArray(response.data) ? response.data : [];
      const offers = stations.map((station) => {
        const address = station.AddressInfo;
        const connection = station.Connections?.[0];
        const offerId = `ocm_${station.ID ?? Math.random()}`;
        const provenance = this.buildProvenance({
          providerRecordId: offerId,
          providerUrl: 'https://openchargemap.org',
          retrievedAt,
          sourceTimestamp: station.DateLastVerified ?? station.DateLastStatusUpdate ?? null,
          liveRead: true,
          simulation: false,
          stale: false,
        });
        const locationParts = [address?.AddressLine1, address?.Town, address?.Country?.Title].filter(Boolean);
        return this.buildOffer({
          offerId,
          category: 'ENERGY',
          title: address?.Title ?? station.OperatorInfo?.Title ?? 'Charging Station',
          description: station.GeneralComments ?? connection?.ConnectionType?.Title ?? null,
          location: locationParts.join(', ') || null,
          city: address?.Town ?? request.city ?? null,
          country: address?.Country?.ISOCode ?? request.country ?? null,
          latitude: address?.Latitude ?? null,
          longitude: address?.Longitude ?? null,
          priceMinorUnits: null,
          currency: null,
          priceLabel: connection?.PowerKW ? `${connection.PowerKW} kW` : null,
          imageUrl: null,
          externalUrl: station.ID ? `https://openchargemap.org/poi/${station.ID}` : null,
          availability: station.StatusType?.Title ?? 'UNKNOWN',
          metadata: Object.freeze({
            stationId: station.ID ?? null,
            operator: station.OperatorInfo?.Title ?? null,
            connectionTypes: connection?.ConnectionType?.Title ?? null,
            powerKW: connection?.PowerKW ?? null,
            quantity: connection?.Quantity ?? null,
            usageType: station.UsageType?.Title ?? null,
            operationalStatus: station.StatusType?.Title ?? null,
            bookable: false,
          }),
          provenance,
        });
      });

      const provenance = this.buildProvenance({
        providerRecordId: 'open-charge-map-search',
        providerUrl: 'https://api.openchargemap.io/v3/poi/',
        retrievedAt,
        sourceTimestamp: null,
        liveRead: true,
        simulation: false,
        stale: false,
      });
      return this.succeed(Object.freeze(offers), provenance);
    });
  }
}

export function createOpenChargeMapLiveAdapter(deps?: BaseLiveAdapterDeps): OpenChargeMapLiveAdapter {
  return new OpenChargeMapLiveAdapter(deps);
}
