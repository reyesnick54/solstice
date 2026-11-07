/**
 * RAW (immutable) vs ADJUSTED_RESEARCH price series.
 */

import type { UtcInstant } from '@solstice/domain';

import type {
  AdjustedResearchBar,
  AppendRawBarInput,
  CorporateAction,
  RawPriceBar,
} from './types.ts';

const ADJUSTMENT_FACTOR_SCALE = 1_000_000;

export function rejectRawBarMutation(): void {
  /* call site marker — raw bars are append-only; store.restore replaces wholesale only */
}

export function rawBarKey(bar: Pick<RawPriceBar, 'instrumentIdentityId' | 'barTime' | 'observationId'>): string {
  return `${bar.instrumentIdentityId}:${bar.barTime}:${bar.observationId}`;
}

export function appendRawPriceBar(
  rawBars: Map<string, RawPriceBar[]>,
  input: AppendRawBarInput,
): RawPriceBar {
  const bar: RawPriceBar = Object.freeze({
    seriesKind: 'RAW',
    ...input,
  });
  const list = rawBars.get(bar.instrumentIdentityId) ?? [];
  if (list.some((row) => rawBarKey(row) === rawBarKey(bar))) {
    throw new Error('duplicate raw market event — raw series is append-only and never rewritten');
  }
  list.push(bar);
  rawBars.set(bar.instrumentIdentityId, list);
  return bar;
}

function scalePrice(minor: bigint, factorScaled: bigint): bigint {
  return (minor * factorScaled) / BigInt(ADJUSTMENT_FACTOR_SCALE);
}

function splitFactorForAction(action: CorporateAction): bigint {
  if (action.kind !== 'SPLIT' && action.kind !== 'REVERSE_SPLIT') {
    return BigInt(ADJUSTMENT_FACTOR_SCALE);
  }
  const num = action.splitNumerator ?? 1;
  const den = action.splitDenominator ?? 1;
  if (num <= 0 || den <= 0) {
    return BigInt(ADJUSTMENT_FACTOR_SCALE);
  }
  const ratio = num / den;
  if (action.kind === 'REVERSE_SPLIT') {
    return BigInt(Math.round((ADJUSTMENT_FACTOR_SCALE * den) / num));
  }
  return BigInt(Math.round(ADJUSTMENT_FACTOR_SCALE / ratio));
}

function cumulativeFactorBefore(
  actions: readonly CorporateAction[],
  barTime: UtcInstant,
  knowableAtCutoff: UtcInstant,
): bigint {
  let factor = BigInt(ADJUSTMENT_FACTOR_SCALE);
  const eligible = actions
    .filter((row) => {
      const ex = row.schedule.exDate;
      if (ex === null) return false;
      if (Date.parse(knowableAtCutoff) < Date.parse(row.schedule.knowableAt)) return false;
      return Date.parse(ex) <= Date.parse(barTime);
    })
    .sort((a, b) => Date.parse(a.schedule.exDate!) - Date.parse(b.schedule.exDate!));

  for (const action of eligible) {
    factor = (factor * splitFactorForAction(action)) / BigInt(ADJUSTMENT_FACTOR_SCALE);
  }
  return factor;
}

export function buildAdjustedResearchSeries(
  raw: readonly RawPriceBar[],
  actions: readonly CorporateAction[],
  knowableAtCutoff: UtcInstant,
): AdjustedResearchBar[] {
  const sorted = [...raw].sort((a, b) => Date.parse(a.barTime) - Date.parse(b.barTime));
  return sorted.map((bar) => {
    const factor = cumulativeFactorBefore(actions, bar.barTime, knowableAtCutoff);
    return Object.freeze({
      seriesKind: 'ADJUSTED_RESEARCH' as const,
      instrumentIdentityId: bar.instrumentIdentityId,
      barTime: bar.barTime,
      openMinor: scalePrice(bar.openMinor, factor),
      highMinor: scalePrice(bar.highMinor, factor),
      lowMinor: scalePrice(bar.lowMinor, factor),
      closeMinor: scalePrice(bar.closeMinor, factor),
      volume: bar.volume,
      derivedFromObservationIds: Object.freeze([bar.observationId]),
      adjustmentFactorScaled: factor,
      adjustmentFactorScale: ADJUSTMENT_FACTOR_SCALE,
      knowableAt: bar.knowableAt,
    });
  });
}

export function rawSeriesUnchangedAfterAdjustment(
  before: readonly RawPriceBar[],
  after: readonly RawPriceBar[],
): boolean {
  if (before.length !== after.length) return false;
  for (let i = 0; i < before.length; i += 1) {
    const a = before[i]!;
    const b = after[i]!;
    if (a.closeMinor !== b.closeMinor || a.observationId !== b.observationId) {
      return false;
    }
  }
  return true;
}
