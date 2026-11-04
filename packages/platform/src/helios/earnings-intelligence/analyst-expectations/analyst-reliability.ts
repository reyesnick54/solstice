/**
 * Historical analyst skill metrics — no future-outcome leakage.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  AnalystForecast,
  AnalystTrackRecord,
  ResolvedForecastOutcome,
} from './types.ts';
import { filterKnowableForecasts } from './consensus.ts';
import { mean } from './statistics.ts';

function outcomeKey(o: ResolvedForecastOutcome): string {
  return `${o.securityId}|${o.metric}|${o.fiscalPeriod.periodLabel}`;
}

function forecastKey(f: AnalystForecast): string {
  return `${f.securityId}|${f.metric}|${f.fiscalPeriod.periodLabel}`;
}

export function buildAnalystTrackRecords(input: {
  readonly forecasts: readonly AnalystForecast[];
  readonly outcomes: readonly ResolvedForecastOutcome[];
  readonly asOf: UtcInstant;
  readonly sectorBySecurity: Readonly<Record<string, string>>;
  readonly recencyHalfLifeDays?: number;
}): Map<string, AnalystTrackRecord> {
  const halfLife = input.recencyHalfLifeDays ?? 180;
  const asOfMs = Date.parse(input.asOf);
  const pitForecasts = filterKnowableForecasts(input.forecasts, input.asOf);

  const outcomesByKey = new Map<string, ResolvedForecastOutcome[]>();
  for (const o of input.outcomes) {
    if (Date.parse(o.knowableAt) > asOfMs) continue;
    const key = outcomeKey(o);
    const list = outcomesByKey.get(key) ?? [];
    list.push(o);
    outcomesByKey.set(key, list);
  }

  const byAnalyst = new Map<string, AnalystForecast[]>();
  for (const f of pitForecasts) {
    if (!f.analystId) continue;
    const list = byAnalyst.get(f.analystId) ?? [];
    list.push(f);
    byAnalyst.set(f.analystId, list);
  }

  const records = new Map<string, AnalystTrackRecord>();

  for (const [analystId, analystForecasts] of byAnalyst) {
    const errors: number[] = [];
    const directionalHits: number[] = [];
    const sectorHits: number[] = [];
    const firmHits: number[] = [];
    const recencyWeights: number[] = [];
    const horizonBuckets = new Map<string, { hits: number; total: number }>();

    for (const f of analystForecasts) {
      const outcomes = outcomesByKey.get(forecastKey(f));
      if (!outcomes || outcomes.length === 0) continue;

      const outcome = outcomes.find((o) => Date.parse(o.knowableAt) > Date.parse(f.knowableAt));
      if (!outcome) continue;
      if (Date.parse(outcome.knowableAt) > asOfMs) continue;

      const err = Math.abs(f.value - outcome.realizedValue);
      errors.push(err);

      const priorConsensus = mean(
        pitForecasts
          .filter(
            (x) =>
              x.forecastId !== f.forecastId
              && x.metric === f.metric
              && x.fiscalPeriod.periodLabel === f.fiscalPeriod.periodLabel
              && Date.parse(x.knowableAt) <= Date.parse(f.knowableAt),
          )
          .map((x) => x.value),
      );
      const forecastDirection = f.value - priorConsensus;
      const realizedDirection = outcome.realizedValue - priorConsensus;
      directionalHits.push(Math.sign(forecastDirection) === Math.sign(realizedDirection) ? 1 : 0);

      const sector = input.sectorBySecurity[f.securityId];
      if (sector) {
        const sectorPeers = pitForecasts.filter(
          (x) =>
            input.sectorBySecurity[x.securityId] === sector
            && x.analystId === analystId
            && x.forecastId !== f.forecastId,
        );
        if (sectorPeers.length > 0) {
          const peerErr = mean(sectorPeers.map((p) => Math.abs(p.value - outcome.realizedValue)));
          sectorHits.push(err <= peerErr ? 1 : 0);
        }
      }

      const firmPeers = pitForecasts.filter(
        (x) =>
          x.analystId === analystId
          && x.securityId === f.securityId
          && x.forecastId !== f.forecastId,
      );
      if (firmPeers.length > 0) {
        const firmErr = mean(firmPeers.map((p) => Math.abs(p.value - outcome.realizedValue)));
        firmHits.push(err <= firmErr ? 1 : 0);
      }

      const ageDays = (Date.parse(outcome.knowableAt) - Date.parse(f.knowableAt)) / 86_400_000;
      recencyWeights.push(Math.exp(-Math.log(2) * (ageDays / halfLife)));

      const horizonLabel =
        f.horizonDays <= 30 ? 'short' : f.horizonDays <= 120 ? 'medium' : 'long';
      const bucket = horizonBuckets.get(horizonLabel) ?? { hits: 0, total: 0 };
      bucket.total += 1;
      if (err <= priorConsensus || directionalHits[directionalHits.length - 1] === 1) {
        bucket.hits += 1;
      }
      horizonBuckets.set(horizonLabel, bucket);
    }

    if (errors.length === 0) continue;

    const horizonAccuracies = [...horizonBuckets.values()].map((b) =>
      b.total > 0 ? b.hits / b.total : 0,
    );

    records.set(
      analystId,
      Object.freeze({
        analystId,
        pastAbsoluteError: mean(errors),
        pastDirectionalAccuracy: directionalHits.length > 0 ? mean(directionalHits) : 0,
        sectorAccuracy: sectorHits.length > 0 ? mean(sectorHits) : 0,
        firmSpecificAccuracy: firmHits.length > 0 ? mean(firmHits) : 0,
        recencyWeightedAccuracy:
          recencyWeights.length > 0
            ? mean(directionalHits.map((h, i) => h * (recencyWeights[i] ?? 1)))
            : 0,
        forecastHorizonAccuracy:
          horizonAccuracies.length > 0 ? mean(horizonAccuracies) : 0,
        sampleCount: errors.length,
        computedAsOf: input.asOf,
      }),
    );
  }

  return records;
}
