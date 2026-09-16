/**
 * HELIOS capital market data integration.
 *
 * HELIOS consumes provider-neutral observations from the capital-market service.
 * No vendor-specific JSON crosses this boundary. No hidden fixture fallback.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { CapitalMarketProvider } from '../provider.ts';
import { CapitalMarketService, createCapitalMarketService, type CapitalMarketServiceOptions } from '../service.ts';
import type { CapitalMarketObservation, CapitalMarketRouteDiagnostics, CapitalMarketRouteStatus } from '../types.ts';

export type HeliosMarketDataRouteStatus = CapitalMarketRouteStatus;

export type HeliosMarketDataObservation = CapitalMarketObservation;

export type HeliosMarketDataRouteSnapshot = {
  readonly routeId: 'helios.capital-market.finnhub';
  readonly providerId: string;
  readonly status: HeliosMarketDataRouteStatus;
  readonly diagnostics: CapitalMarketRouteDiagnostics;
  readonly evaluatedAt: UtcInstant;
};

export type HeliosMarketDataFetchResult =
  | {
      readonly ok: true;
      readonly observation: HeliosMarketDataObservation;
      readonly route: HeliosMarketDataRouteSnapshot;
      readonly fromCache: boolean;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
      readonly route: HeliosMarketDataRouteSnapshot;
    };

export type HeliosMarketDataRouteOptions = CapitalMarketServiceOptions;

export class HeliosMarketDataRoute {
  readonly #service: CapitalMarketService;

  constructor(options: HeliosMarketDataRouteOptions = {}) {
    this.#service = options.provider
      ? new CapitalMarketService(options)
      : createCapitalMarketService(options);
  }

  get provider(): CapitalMarketProvider {
    return this.#service.provider;
  }

  status(nowUtc: UtcInstant): HeliosMarketDataRouteSnapshot {
    const diagnostics = this.#service.diagnostics(nowUtc);
    return Object.freeze({
      routeId: 'helios.capital-market.finnhub',
      providerId: diagnostics.providerId,
      status: diagnostics.routeStatus,
      diagnostics,
      evaluatedAt: nowUtc,
    });
  }

  async fetchObservation(instrumentId: string, nowUtc: UtcInstant): Promise<HeliosMarketDataFetchResult> {
    const route = this.status(nowUtc);
    if (route.status === 'NOT_CONFIGURED' || route.status === 'NOT_QUALIFIED') {
      return Object.freeze({
        ok: false,
        code: route.status,
        message: route.diagnostics.message ?? `market data route is ${route.status}`,
        route,
      });
    }

    const result = await this.#service.getObservation(instrumentId, nowUtc);
    if (!result.ok) {
      const degradedRoute = Object.freeze({
        ...route,
        status: result.code === 'RATE_LIMITED' ? 'DEGRADED' : 'UNAVAILABLE',
      });
      return Object.freeze({
        ok: false,
        code: result.code,
        message: result.message,
        route: degradedRoute,
      });
    }

    return Object.freeze({
      ok: true,
      observation: result.value,
      route,
      fromCache: result.fromCache,
    });
  }
}

export function createHeliosMarketDataRoute(options?: HeliosMarketDataRouteOptions): HeliosMarketDataRoute {
  return new HeliosMarketDataRoute(options);
}

export function heliosMarketDataNowUtc(): UtcInstant {
  return asUtcInstant(new Date().toISOString());
}
