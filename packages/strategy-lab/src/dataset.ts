import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { asMarketDatasetId, type MarketDatasetId, type MarketDatasetVersion } from './ids.ts';
import { STRATEGY_RESOURCE_LIMITS, type StrategyFailure } from './types.ts';

export type CorporateActionFixture = {
  readonly kind: 'DIVIDEND' | 'SPLIT';
  readonly instrumentId: string;
  readonly at: UtcInstant;
  readonly cashMinorPerShare?: bigint;
  readonly splitNumerator?: bigint;
  readonly splitDenominator?: bigint;
};

export type UniverseMembership = {
  readonly instrumentId: string;
  readonly enteredAt: UtcInstant;
  readonly leftAt: UtcInstant | null;
};

export type MarketObservation = {
  readonly instrumentId: string;
  readonly at: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly available: boolean;
};

export type MarketDataset = {
  readonly datasetId: MarketDatasetId;
  readonly version: MarketDatasetVersion;
  readonly instruments: readonly string[];
  readonly membership: readonly UniverseMembership[];
  readonly timeRange: { readonly start: UtcInstant; readonly end: UtcInstant };
  readonly frequency: 'DAILY';
  readonly source: 'SYNTHETIC_FIXTURE';
  readonly provenance: string;
  readonly currency: string;
  readonly corporateActionHandling: 'INVESTMENTS_SPLIT_DIVIDEND_SEMANTICS';
  readonly completeness: 'COMPLETE_FOR_FIXTURE' | 'GAPPED';
  readonly limitations: readonly string[];
  readonly observations: readonly MarketObservation[];
  readonly corporateActions: readonly CorporateActionFixture[];
  readonly hash: string;
  readonly liveMarketData: false;
};

export type PointInTimeView = {
  readonly at: UtcInstant;
  readonly observations: readonly MarketObservation[];
  readonly membership: readonly string[];
  readonly corporateActions: readonly CorporateActionFixture[];
};

function canonicalDataset(input: Omit<MarketDataset, 'hash' | 'liveMarketData' | 'datasetId'> & {
  readonly datasetId?: MarketDatasetId;
}): string {
  return JSON.stringify(
    {
      ...input,
      observations: input.observations.map((row) => ({
        ...row,
        openMinor: row.openMinor.toString(),
        highMinor: row.highMinor.toString(),
        lowMinor: row.lowMinor.toString(),
        closeMinor: row.closeMinor.toString(),
      })),
      corporateActions: input.corporateActions.map((row) => ({
        ...row,
        cashMinorPerShare: row.cashMinorPerShare?.toString() ?? null,
        splitNumerator: row.splitNumerator?.toString() ?? null,
        splitDenominator: row.splitDenominator?.toString() ?? null,
      })),
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );
}

export function freezeMarketDataset(
  input: Omit<MarketDataset, 'hash' | 'liveMarketData' | 'datasetId'> & {
    readonly datasetId?: MarketDatasetId;
  },
): Result<MarketDataset, StrategyFailure> {
  if (input.version.length === 0) {
    return err({ code: 'UNVERSIONED_DATASET', message: 'dataset version is required' });
  }
  if (input.observations.length > STRATEGY_RESOURCE_LIMITS.maximumObservations) {
    return err({
      code: 'RESOURCE_LIMIT',
      message: `dataset exceeds maximumObservations=${String(STRATEGY_RESOURCE_LIMITS.maximumObservations)}`,
    });
  }
  const hash = createHash('sha256').update(canonicalDataset(input)).digest('hex');
  return ok(
    Object.freeze({
      ...input,
      datasetId: input.datasetId ?? asMarketDatasetId(`mds_${hash.slice(0, 20)}`),
      instruments: Object.freeze([...input.instruments]),
      membership: Object.freeze([...input.membership]),
      limitations: Object.freeze([...input.limitations]),
      observations: Object.freeze([...input.observations]),
      corporateActions: Object.freeze([...input.corporateActions]),
      hash,
      liveMarketData: false,
    }),
  );
}

export function membersAt(dataset: MarketDataset, at: UtcInstant): readonly string[] {
  return Object.freeze(
    dataset.membership
      .filter((row) => row.enteredAt <= at && (row.leftAt === null || row.leftAt > at))
      .map((row) => row.instrumentId),
  );
}

export function pointInTime(dataset: MarketDataset, at: UtcInstant): PointInTimeView {
  return Object.freeze({
    at,
    observations: Object.freeze(dataset.observations.filter((row) => row.at <= at)),
    membership: membersAt(dataset, at),
    corporateActions: Object.freeze(dataset.corporateActions.filter((row) => row.at <= at)),
  });
}

export function observationAt(
  dataset: MarketDataset,
  instrumentId: string,
  at: UtcInstant,
): Result<MarketObservation, StrategyFailure> {
  if (at > dataset.timeRange.end) {
    return err({
      code: 'FUTURE_DATA_FORBIDDEN',
      message: `observation requested after dataset end ${dataset.timeRange.end}`,
    });
  }
  const match = dataset.observations.find((row) => row.instrumentId === instrumentId && row.at === at);
  if (!match) {
    const later = dataset.observations.find((row) => row.instrumentId === instrumentId && row.at > at);
    if (later) {
      return err({
        code: 'FUTURE_DATA_FORBIDDEN',
        message: `price for ${instrumentId} at ${later.at} is not available at simulation time ${at}`,
      });
    }
    return err({
      code: 'FUTURE_DATA_FORBIDDEN',
      message: `no point-in-time observation for ${instrumentId} at ${at}`,
    });
  }
  return ok(match);
}

export function latestCloseAt(
  dataset: MarketDataset,
  instrumentId: string,
  at: UtcInstant,
): Result<MarketObservation, StrategyFailure> {
  const available = dataset.observations
    .filter((row) => row.instrumentId === instrumentId && row.at <= at && row.available)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const latest = available[0];
  if (!latest) {
    return err({
      code: 'FUTURE_DATA_FORBIDDEN',
      message: `no close at or before ${at} for ${instrumentId}`,
    });
  }
  return ok(latest);
}

export function windowCloses(
  dataset: MarketDataset,
  instrumentId: string,
  at: UtcInstant,
  window: number,
): readonly bigint[] {
  return Object.freeze(
    dataset.observations
      .filter((row) => row.instrumentId === instrumentId && row.at <= at && row.available)
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .slice(-window)
      .map((row) => row.closeMinor),
  );
}
