import type { ContinuousSeriesDefinition, MarketCalendarRegistry } from './types.ts';
import { resolveFrontContract } from './futures.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';

export function isContinuousResearchSeries(series: ContinuousSeriesDefinition): true {
  return series.executable === false;
}

export function resolveContinuousSeriesContract(input: {
  readonly seriesId: string;
  readonly at: UtcInstant;
  readonly registry: MarketCalendarRegistry;
}): { readonly series: ContinuousSeriesDefinition; readonly researchContractId: string | null; readonly executable: false } | null {
  const series = input.registry.getContinuousSeries(input.seriesId);
  if (!series) {
    return null;
  }
  const front = resolveFrontContract({
    rootSymbol: series.rootSymbol,
    at: input.at,
    registry: input.registry,
  });
  return Object.freeze({
    series,
    researchContractId: front?.contractId ?? null,
    executable: false,
  });
}

export function continuousSeriesBlocksExecution(series: ContinuousSeriesDefinition): true {
  return series.executable === false;
}
