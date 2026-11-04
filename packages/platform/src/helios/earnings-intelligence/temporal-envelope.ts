/**
 * Shared temporal and provenance fields for earnings intelligence artifacts.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { QualityState } from '../observation/types.ts';

export type EarningsFiscalPeriod = {
  readonly fiscalYear: number;
  readonly fiscalQuarter: 1 | 2 | 3 | 4 | null;
  readonly periodLabel: string;
  readonly periodEndDate: string | null;
};

export type EarningsSourceRef = {
  readonly sourceId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly upstreamRef: string | null;
};

export type EarningsTemporalEnvelope = {
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly fiscalPeriod: EarningsFiscalPeriod;
  readonly eventTime: UtcInstant | null;
  readonly publishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly revisionId: string | null;
  readonly sourceRefs: readonly EarningsSourceRef[];
  readonly evidenceRefs: readonly string[];
  readonly qualityState: QualityState;
};
