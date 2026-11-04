/**
 * Revision dynamics across analyst forecast history.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  AnalystForecast,
  AnalystForecastRevision,
  ConsensusRevisionState,
} from './types.ts';
import { filterKnowableForecasts } from './consensus.ts';
import { mean } from './statistics.ts';

export function detectForecastRevisions(forecasts: readonly AnalystForecast[]): AnalystForecastRevision[] {
  const byId = new Map(forecasts.map((f) => [f.forecastId, f]));
  const revisions: AnalystForecastRevision[] = [];

  for (const f of forecasts) {
    if (!f.revisionOf) continue;
    const prior = byId.get(f.revisionOf);
    if (!prior) continue;
    if (prior.metric !== f.metric || prior.fiscalPeriod.periodLabel !== f.fiscalPeriod.periodLabel) continue;

    revisions.push(
      Object.freeze({
        revisionId: `${f.forecastId}:rev`,
        priorForecastId: prior.forecastId,
        revisedForecastId: f.forecastId,
        analystId: f.analystId,
        metric: f.metric,
        fiscalPeriod: f.fiscalPeriod,
        priorValue: prior.value,
        revisedValue: f.value,
        delta: f.value - prior.value,
        revisedAt: f.issuedAt,
        knowableAt: f.knowableAt,
      }),
    );
  }

  return revisions.sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt));
}

function consensusSeriesFromRevisions(
  revisions: readonly AnalystForecastRevision[],
  windowDays: number,
): { readonly t: number; readonly consensusDelta: number }[] {
  if (revisions.length === 0) return [];
  const start = Date.parse(revisions[0]!.knowableAt);
  const buckets = new Map<number, number[]>();

  for (const r of revisions) {
    const day = Math.floor((Date.parse(r.knowableAt) - start) / 86_400_000);
    if (day < 0 || day > windowDays) continue;
    const list = buckets.get(day) ?? [];
    list.push(r.delta);
    buckets.set(day, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, deltas]) => ({
      t: day,
      consensusDelta: mean(deltas),
    }));
}

export function buildConsensusRevisionState(input: {
  readonly forecasts: readonly AnalystForecast[];
  readonly asOf: UtcInstant;
  readonly analystUniverseSize: number;
  readonly lookbackDays?: number;
}): ConsensusRevisionState {
  const lookbackDays = input.lookbackDays ?? 30;
  const asOfMs = Date.parse(input.asOf);
  const pit = filterKnowableForecasts(input.forecasts, input.asOf);
  const revisions = detectForecastRevisions(pit).filter(
    (r) => asOfMs - Date.parse(r.knowableAt) <= lookbackDays * 86_400_000,
  );

  const analystIds = new Set(
    revisions.map((r) => r.analystId).filter((id): id is string => id !== null),
  );
  const revisionBreadth =
    input.analystUniverseSize > 0 ? analystIds.size / input.analystUniverseSize : 0;

  const magnitudes = revisions.map((r) => Math.abs(r.delta));
  const revisionMagnitude = magnitudes.length > 0 ? mean(magnitudes) : 0;

  const upward = revisions.filter((r) => r.delta > 0).length;
  const downward = revisions.filter((r) => r.delta < 0).length;
  const totalDir = upward + downward;
  const upwardRevisionShare = totalDir > 0 ? upward / totalDir : 0;
  const downwardRevisionShare = totalDir > 0 ? downward / totalDir : 0;

  const lastRevision = revisions.length > 0 ? revisions[revisions.length - 1]! : null;
  const daysSinceLastRevision =
    lastRevision === null
      ? null
      : (asOfMs - Date.parse(lastRevision.knowableAt)) / 86_400_000;

  const series = consensusSeriesFromRevisions(revisions, lookbackDays);
  const velocities = series.slice(1).map((p, i) => p.consensusDelta - series[i]!.consensusDelta);
  const revisionVelocity = velocities.length > 0 ? mean(velocities) : 0;
  const accelerations = velocities.slice(1).map((v, i) => v - velocities[i]!);
  const revisionAcceleration = accelerations.length > 0 ? mean(accelerations) : 0;

  const signedDeltas = revisions.map((r) => r.delta);
  const consensusMomentum = signedDeltas.length > 0 ? mean(signedDeltas) : 0;
  const consensusAcceleration = revisionAcceleration;

  return Object.freeze({
    revisionBreadth,
    revisionMagnitude,
    revisionVelocity,
    revisionAcceleration,
    upwardRevisionShare,
    downwardRevisionShare,
    daysSinceLastRevision,
    consensusMomentum,
    consensusAcceleration,
  });
}
