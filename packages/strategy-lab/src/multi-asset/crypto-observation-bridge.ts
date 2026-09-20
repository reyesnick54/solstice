import type { UtcInstant } from '../../../domain/src/time.ts';
import { buildChronologicalObservation, type ChronologicalObservation } from '../evaluation/manifest.ts';
import { HELIOS_CRYPTO_OBSERVATION_SCHEMA } from './constants.ts';

export type CryptoOhlcvBarInput = {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly periodStart: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerId: string;
  readonly providerSequence: number;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly bidMinor?: bigint | null;
  readonly askMinor?: bigint | null;
  readonly available?: boolean;
  readonly sessionOpen?: boolean;
  readonly degraded?: boolean;
};

export function cryptoBarToChronologicalObservation(input: CryptoOhlcvBarInput): ChronologicalObservation {
  return buildChronologicalObservation({
    observationId: input.observationId,
    instrumentId: input.instrumentId,
    sourceEventTime: input.periodStart,
    providerAvailabilityTime: input.knowableAt,
    sunreyArrivalTime: input.knowableAt,
    ingestionTime: input.knowableAt,
    providerId: input.providerId,
    providerSequence: input.providerSequence,
    openMinor: input.openMinor,
    highMinor: input.highMinor,
    lowMinor: input.lowMinor,
    closeMinor: input.closeMinor,
    bidMinor: input.bidMinor ?? input.closeMinor - 5n,
    askMinor: input.askMinor ?? input.closeMinor + 5n,
    available: input.available ?? true,
    sessionOpen: input.sessionOpen ?? true,
    degraded: input.degraded ?? false,
    corporateActionVersion: HELIOS_CRYPTO_OBSERVATION_SCHEMA,
  });
}
