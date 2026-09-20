import type { UtcInstant } from '@solstice/domain';
import type { HeliosMultiAssetBarInterval, HeliosMultiAssetIndexInstrument } from './taxonomy.ts';

export type HeliosBar15mObservation = {
  readonly instrumentId: HeliosMultiAssetIndexInstrument;
  readonly barInterval: HeliosMultiAssetBarInterval;
  readonly sourceEventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly bidMinor: bigint | null;
  readonly askMinor: bigint | null;
  readonly spreadBps: bigint | null;
  readonly sessionState: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly marketState: 'NORMAL' | 'DEGRADED' | 'HALTED' | 'STALE' | 'UNAVAILABLE';
  readonly liquidityState: 'NORMAL' | 'WIDE' | 'THIN' | 'UNAVAILABLE';
  readonly marketRegime: 'TRENDING' | 'MEAN_REVERTING' | 'HIGH_VOL' | 'LOW_VOL' | 'UNKNOWN';
  readonly providerId: string;
  readonly observationId: string;
};

export type HeliosMultiAssetBarStoreSnapshot = {
  readonly bars: readonly HeliosBar15mObservation[];
};

export type HeliosMultiAssetBarStorePort = {
  append(bar: HeliosBar15mObservation): void;
  barsFor(instrumentId: string, asOf: UtcInstant): readonly HeliosBar15mObservation[];
  snapshot(): HeliosMultiAssetBarStoreSnapshot;
};
