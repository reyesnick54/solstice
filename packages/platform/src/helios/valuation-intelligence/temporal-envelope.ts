/**
 * Shared temporal and provenance fields for valuation intelligence artifacts.
 */

import type { UtcInstant } from '@solstice/domain';
import type { QualityState } from '../observation/types.ts';

export type ValuationSourceRef = {
  readonly sourceId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly upstreamRef: string | null;
};

export type ValuationTemporalEnvelope = {
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly asOfTradeDate: string | null;
  readonly eventTime: UtcInstant | null;
  readonly publishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly revisionId: string | null;
  readonly sourceRefs: readonly ValuationSourceRef[];
  readonly evidenceRefs: readonly string[];
  readonly qualityState: QualityState;
};
