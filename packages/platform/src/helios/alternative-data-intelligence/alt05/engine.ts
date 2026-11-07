/**
 * ALT05 — compose observations into DigitalDemandState.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  AppDemandObservation,
  DigitalDemandState,
  SearchAttentionObservation,
  WebDemandObservation,
} from '../types.ts';
import type { DigitalDemandInputFamily } from '../taxonomy.ts';
import type { SearchSeriesReliability } from '../types.ts';
import { assessDigitalDemandAnomaly } from './anomaly.ts';
import {
  initRobustLatentFilter,
  latentDigitalDemandFromFilter,
  signalsFromNormalizedFeatures,
  stepRobustLatentFilter,
} from './latent-demand.ts';

export type CompileDigitalDemandStateInput = {
  readonly stateId: string;
  readonly entityId: string;
  readonly asOf: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly search: SearchAttentionObservation | null;
  readonly web: WebDemandObservation | null;
  readonly app: AppDemandObservation | null;
  readonly searchReliability: SearchSeriesReliability | null;
  readonly demandHistorySeries?: readonly number[];
  readonly demandHistoryPeriodEnds?: readonly UtcInstant[];
};

export function compileDigitalDemandState(input: CompileDigitalDemandStateInput): DigitalDemandState {
  const families: DigitalDemandInputFamily[] = [];
  if (input.search) families.push('SEARCH_TRENDS', 'DIGITAL_ENGAGEMENT');
  if (input.web) families.push('WEB_TRAFFIC', 'DIGITAL_ENGAGEMENT');
  if (input.app) families.push('APP_ACTIVITY', 'APP_RANKING', 'DIGITAL_ENGAGEMENT');

  const uniqueFamilies = Object.freeze([...new Set(families)]);

  const searchLevel = input.search?.features.searchLevel ?? null;
  const webGrowth = input.web?.features.visitGrowth ?? null;
  const appGrowth = input.app?.features.usageGrowth ?? null;
  const engagement =
    input.web?.features.engagementDurationAggregate ??
    input.search?.features.searchMomentum ??
    null;

  const signals = signalsFromNormalizedFeatures({
    searchLevel,
    webVisitGrowth: webGrowth,
    appUsageGrowth: appGrowth,
    engagement,
    searchReliabilityBps: input.searchReliability?.reliabilityScoreBps ?? null,
  });

  const seed = searchLevel ?? webGrowth ?? appGrowth ?? 0;
  const filterState = stepRobustLatentFilter(initRobustLatentFilter(seed), signals);
  const latent = latentDigitalDemandFromFilter(filterState, `latent/${input.stateId}`);

  const history =
    input.demandHistorySeries ??
    input.search?.rawIndexSeries ??
    (searchLevel !== null ? [searchLevel] : [latent.level]);
  const periodEnds = input.demandHistoryPeriodEnds ?? [];
  const anomaly = assessDigitalDemandAnomaly({
    demandSeries: history,
    latestLevel: latent.level,
    periodEnds,
  });

  return Object.freeze({
    stateId: input.stateId,
    entityId: input.entityId,
    asOf: input.asOf,
    compiledAt: input.compiledAt,
    inputFamiliesPresent: uniqueFamilies,
    search: input.search,
    web: input.web,
    app: input.app,
    searchReliability: input.searchReliability,
    latent,
    anomaly,
  });
}

export function assertEstimatesNotExactCounts(state: DigitalDemandState): void {
  const estimates = [
    state.web?.features.visits,
    state.web?.features.uniqueAggregateVisitors,
    state.app?.features.downloadEstimate,
    state.app?.features.activeUserEstimate,
    state.app?.features.reviewVelocity,
  ].filter((row): row is NonNullable<typeof row> => row !== null && row !== undefined);
  for (const est of estimates) {
    if (est.isExactCount !== false) {
      throw new Error('ALT05 estimates must not claim exact user counts');
    }
  }
}

export function assertAggregateOnlyObservations(state: DigitalDemandState): void {
  const envelopes = [state.search?.envelope, state.web?.envelope, state.app?.envelope].filter(
    (e): e is NonNullable<typeof e> => e !== null && e !== undefined,
  );
  for (const env of envelopes) {
    if (env.aggregateOnly !== true || env.individualTrackingProhibited !== true) {
      throw new Error('ALT05 requires aggregate-only licensed/public observations');
    }
  }
}
