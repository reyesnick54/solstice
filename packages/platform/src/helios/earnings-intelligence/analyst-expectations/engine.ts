/**
 * EARN04 analyst expectation dynamics engine.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  HELIOS_EARN04_ANALYST_EXPECTATIONS_AUTHORITY,
  HELIOS_EARN04_ANALYST_EXPECTATIONS_SCHEMA,
  HELIOS_EARN04_DATA_PLANE,
} from './taxonomy.ts';
import type {
  AnalystForecast,
  DynamicExpectationState,
  EarningsForecastMetric,
  FiscalPeriodRef,
  MaterialCompanyInformationEvent,
  ResolvedForecastOutcome,
} from './types.ts';
import { buildConsensusSnapshot } from './consensus.ts';
import { buildConsensusRevisionState } from './revision-intelligence.ts';
import { buildForecastDispersionState } from './volatility-of-disagreement.ts';
import { measureAnalystResponsiveness } from './analyst-responsiveness.ts';
import { buildAnalystTrackRecords } from './analyst-reliability.ts';
import { createDynamicConsensusFilter, type DynamicConsensusFilterOptions } from './dynamic-consensus-filter.ts';

export type BuildDynamicExpectationStateInput = {
  readonly securityId: string;
  readonly fiscalPeriod: FiscalPeriodRef;
  readonly metric: EarningsForecastMetric;
  readonly forecasts: readonly AnalystForecast[];
  readonly outcomes: readonly ResolvedForecastOutcome[];
  readonly historicalConsensusSnapshots: readonly import('./types.ts').ConsensusSnapshot[];
  readonly materialEvent?: MaterialCompanyInformationEvent | null;
  readonly sectorBySecurity: Readonly<Record<string, string>>;
  readonly asOf: UtcInstant;
  readonly analystUniverseSize?: number;
  readonly filterOptions?: DynamicConsensusFilterOptions;
  readonly priorLatent?: number | null;
};

export function buildDynamicExpectationState(
  input: BuildDynamicExpectationStateInput,
): DynamicExpectationState | null {
  const consensus = buildConsensusSnapshot({
    securityId: input.securityId,
    fiscalPeriod: input.fiscalPeriod,
    metric: input.metric,
    forecasts: input.forecasts,
    asOf: input.asOf,
  });
  if (!consensus) return null;

  const analystUniverseSize =
    input.analystUniverseSize
    ?? new Set(
      input.forecasts
        .filter((f) => f.analystId && f.securityId === input.securityId)
        .map((f) => f.analystId as string),
    ).size;

  const revisionState = buildConsensusRevisionState({
    forecasts: input.forecasts,
    asOf: input.asOf,
    analystUniverseSize,
  });

  const dispersionState = buildForecastDispersionState({
    currentConsensus: consensus,
    historicalConsensusSnapshots: input.historicalConsensusSnapshots,
  });

  const trackRecords = buildAnalystTrackRecords({
    forecasts: input.forecasts,
    outcomes: input.outcomes,
    asOf: input.asOf,
    sectorBySecurity: input.sectorBySecurity,
  });

  const filter = createDynamicConsensusFilter(input.filterOptions);
  const streetDistribution = filter.update({
    forecasts: input.forecasts,
    trackRecords,
    asOf: input.asOf,
    revisionState,
    priorLatent: input.priorLatent ?? null,
  });
  if (!streetDistribution) return null;

  const analystResponsiveness =
    input.materialEvent
      ? measureAnalystResponsiveness({
          securityId: input.securityId,
          fiscalPeriod: input.fiscalPeriod,
          metric: input.metric,
          forecasts: input.forecasts,
          materialEvent: input.materialEvent,
          asOf: input.asOf,
        })
      : null;

  return Object.freeze({
    schema: HELIOS_EARN04_ANALYST_EXPECTATIONS_SCHEMA,
    authority: HELIOS_EARN04_ANALYST_EXPECTATIONS_AUTHORITY,
    securityId: input.securityId,
    fiscalPeriod: input.fiscalPeriod,
    metric: input.metric,
    asOf: input.asOf,
    consensus,
    revisionState,
    dispersionState,
    analystResponsiveness,
    streetDistribution,
    grantsExecutionAuthority: false as const,
    grantsFinancialMutation: false as const,
    dataPlane: HELIOS_EARN04_DATA_PLANE,
  });
}
