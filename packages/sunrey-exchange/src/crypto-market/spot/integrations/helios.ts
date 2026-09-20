/**
 * HELIOS crypto spot market data integration route.
 *
 * HELIOS consumes provider-neutral observations from the crypto spot service.
 * No vendor-specific JSON crosses this boundary. No hidden fixture fallback.
 */

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import type { CapitalMarketHistoricalIngestRequest, CapitalMarketHistoricalIngestResult } from '../../../capital-market/historical-ingestion.ts';
import type { CapitalMarketProvider } from '../../../capital-market/provider.ts';
import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketRouteDiagnostics,
  CapitalMarketRouteStatus,
  CapitalMarketSessionObservation,
} from '../../../capital-market/types.ts';
import type { CapitalMarketHistoricalRange, CapitalMarketTimeframe } from '../../../capital-market/timeframes.ts';
import { CryptoSpotMarketService, createCryptoSpotMarketService, type CryptoSpotMarketServiceOptions } from '../service.ts';

export type HeliosCryptoMarketRouteStatus = CapitalMarketRouteStatus;

export type HeliosCryptoMarketRouteSnapshot = {
  readonly routeId: 'helios.crypto-market.coingecko';
  readonly providerId: string;
  readonly status: HeliosCryptoMarketRouteStatus;
  readonly diagnostics: CapitalMarketRouteDiagnostics;
  readonly evaluatedAt: UtcInstant;
};

export type HeliosCryptoMarketFetchResult =
  | {
      readonly ok: true;
      readonly observation: CapitalMarketObservation;
      readonly route: HeliosCryptoMarketRouteSnapshot;
      readonly fromCache: boolean;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly route: HeliosCryptoMarketRouteSnapshot;
    };

export type HeliosCryptoMarketRouteOptions = CryptoSpotMarketServiceOptions;

export class HeliosCryptoMarketRoute {
  readonly #service: CryptoSpotMarketService;

  constructor(options: HeliosCryptoMarketRouteOptions = {}) {
    this.#service = options.provider
      ? new CryptoSpotMarketService(options)
      : createCryptoSpotMarketService(options);
  }

  get provider(): CapitalMarketProvider {
    return this.#service.provider;
  }

  get service(): CryptoSpotMarketService {
    return this.#service;
  }

  status(nowUtc: UtcInstant): HeliosCryptoMarketRouteSnapshot {
    const diagnostics = this.#service.diagnostics(nowUtc);
    return Object.freeze({
      routeId: 'helios.crypto-market.coingecko',
      providerId: diagnostics.providerId,
      status: diagnostics.routeStatus,
      diagnostics,
      evaluatedAt: nowUtc,
    });
  }

  async fetchObservation(instrumentId: string, nowUtc: UtcInstant): Promise<HeliosCryptoMarketFetchResult> {
    const route = this.status(nowUtc);
    if (route.status === 'NOT_CONFIGURED' || route.status === 'NOT_QUALIFIED') {
      return Object.freeze({
        ok: false,
        code: route.status,
        message: route.diagnostics.message ?? `crypto market route is ${route.status}`,
        route,
      });
    }

    const result = await this.#service.getObservation(instrumentId, nowUtc);
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        code: result.code,
        message: result.message,
        route: Object.freeze({
          ...route,
          status: result.code === 'RATE_LIMITED' ? 'DEGRADED' : 'UNAVAILABLE',
        }),
      });
    }

    return Object.freeze({
      ok: true,
      observation: result.value,
      route,
      fromCache: result.fromCache,
    });
  }

  async fetchHistoricalBars(
    instrumentId: string,
    timeframe: CapitalMarketTimeframe,
    range: CapitalMarketHistoricalRange,
    nowUtc: UtcInstant,
  ): Promise<
    | { readonly ok: true; readonly bars: readonly CapitalMarketBar[]; readonly route: HeliosCryptoMarketRouteSnapshot }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly route: HeliosCryptoMarketRouteSnapshot }
  > {
    const route = this.status(nowUtc);
    const result = await this.#service.getHistoricalBars(instrumentId, timeframe, range, nowUtc);
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        code: result.code,
        message: result.message,
        route: Object.freeze({
          ...route,
          status: result.code === 'RATE_LIMITED' ? 'DEGRADED' : 'UNAVAILABLE',
        }),
      });
    }
    return Object.freeze({ ok: true, bars: result.value, route });
  }

  async ingestHistoricalBars(request: CapitalMarketHistoricalIngestRequest): Promise<CapitalMarketHistoricalIngestResult> {
    return this.#service.ingestHistoricalBars(request);
  }

  async fetchVenueStatus(
    exchange: string,
    nowUtc: UtcInstant,
  ): Promise<
    | { readonly ok: true; readonly session: CapitalMarketSessionObservation; readonly route: HeliosCryptoMarketRouteSnapshot }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly route: HeliosCryptoMarketRouteSnapshot }
  > {
    const route = this.status(nowUtc);
    const result = await this.#service.getVenueStatus(exchange, nowUtc);
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        code: result.code,
        message: result.message,
        route: Object.freeze({
          ...route,
          status: result.code === 'RATE_LIMITED' ? 'DEGRADED' : 'UNAVAILABLE',
        }),
      });
    }
    return Object.freeze({ ok: true, session: result.value, route });
  }
}

export function createHeliosCryptoMarketRoute(options?: HeliosCryptoMarketRouteOptions): HeliosCryptoMarketRoute {
  return new HeliosCryptoMarketRoute(options);
}

export function heliosCryptoMarketNowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
