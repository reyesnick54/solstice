/**
 * Append-only raw tape and separately maintained adjusted research series.
 */

import type { UtcInstant } from '@solstice/domain';

import type { CorporateAction, PriceSeriesView, RawPriceObservation } from './types.ts';
import type { InstrumentMasterStore } from './store.ts';

export function buildAdjustedResearchSeries(input: {
  readonly store: InstrumentMasterStore;
  readonly instrumentIdentityId: string;
  readonly corporateActions: readonly CorporateAction[];
  readonly asOfKnowableAt: UtcInstant;
}): PriceSeriesView {
  const raw = [...input.store.listRawPrices(input.instrumentIdentityId)].sort(
    (a, b) => Date.parse(a.eventTime) - Date.parse(b.eventTime),
  );

  let factor = 1;
  const actions = [...input.corporateActions]
    .filter((row) => Date.parse(row.knowableAt) <= Date.parse(input.asOfKnowableAt))
    .sort((a, b) => Date.parse(a.exDate ?? a.knowableAt) - Date.parse(b.exDate ?? b.knowableAt));

  for (const action of actions) {
    if (action.kind === 'split' && action.ratioNumerator && action.ratioDenominator) {
      factor *= action.ratioNumerator / action.ratioDenominator;
    }
    if (action.kind === 'reverse_split' && action.ratioNumerator && action.ratioDenominator) {
      factor *= action.ratioNumerator / action.ratioDenominator;
    }
  }

  const points = raw.map((row) =>
    Object.freeze({
      eventTime: row.eventTime,
      closeMinor: BigInt(Math.round(Number(row.closeMinor) / factor)),
    }),
  );

  return Object.freeze({
    seriesKind: 'ADJUSTED_RESEARCH',
    instrumentIdentityId: input.instrumentIdentityId,
    points: Object.freeze(points),
    grantsExecutionAuthority: false,
  });
}

export function rawSeriesDigest(raw: readonly RawPriceObservation[]): string {
  return raw.map((row) => `${row.observationId}:${row.closeMinor}`).join(';');
}
