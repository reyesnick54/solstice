/**
 * External/live fetch guard — never silently substitute fixtures.
 */

import { rejectSilentSimulationFallback } from '@solstice/provider-sdk';
import type { MarketDataRouteClass } from '@solstice/provider-sdk';
import type { CapitalMarketResult } from '@solstice/sunrey-exchange/capital-market';
import type { CapitalMarketObservation } from '@solstice/sunrey-exchange/capital-market';

export type MarketDataFetchOutcome =
  | {
      readonly status: 'OK';
      readonly observation: CapitalMarketObservation;
      readonly fromCache: boolean;
      readonly routeClass: MarketDataRouteClass;
    }
  | {
      readonly status: 'DEGRADED' | 'UNAVAILABLE';
      readonly code: string;
      readonly message: string;
      readonly providerId: string;
      readonly routeClass: MarketDataRouteClass;
      readonly silentFixtureRejected: boolean;
    };

export function guardExternalMarketDataFetch(input: {
  readonly routeClass: MarketDataRouteClass;
  readonly primaryFailed: boolean;
  readonly attemptedFixtureFallback: boolean;
  readonly fixtureLabeled: boolean;
  readonly environment: string;
  readonly explicitSimulationAllowed: boolean;
}): { readonly allowed: boolean; readonly failureCode: string | null } {
  if (input.routeClass !== 'external_live') {
    return Object.freeze({ allowed: true, failureCode: null });
  }
  return rejectSilentSimulationFallback({
    primaryFailed: input.primaryFailed,
    fallbackToSimulation: input.attemptedFixtureFallback,
    simulationLabeled: input.fixtureLabeled,
    environment: input.environment,
    explicitSimulationAllowed: input.explicitSimulationAllowed,
  });
}

export function mapCapitalMarketResultToFetchOutcome(
  routeClass: MarketDataRouteClass,
  result: CapitalMarketResult<CapitalMarketObservation>,
): MarketDataFetchOutcome {
  if (result.ok) {
    return Object.freeze({
      status: 'OK',
      observation: result.value,
      fromCache: result.fromCache,
      routeClass,
    });
  }
  const status = result.code === 'RATE_LIMITED' || result.code === 'DEGRADED' ? 'DEGRADED' : 'UNAVAILABLE';
  return Object.freeze({
    status,
    code: result.code,
    message: result.message,
    providerId: result.providerId,
    routeClass,
    silentFixtureRejected: result.code === 'SILENT_SIMULATION_REJECTED',
  });
}
