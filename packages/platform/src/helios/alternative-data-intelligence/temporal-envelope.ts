/**
 * ALT05 — temporal envelope for aggregate digital-demand observations.
 */

import type { UtcInstant } from '@solstice/domain';
import type { QualityState } from '../observation/types.ts';
import type { DigitalDemandInputFamily } from './taxonomy.ts';

export type DigitalDemandSourceRef = {
  readonly sourceId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly licenseClass: 'PUBLIC_AGGREGATE' | 'LICENSED_AGGREGATE' | 'SANDBOX_FIXTURE';
  readonly upstreamRef: string | null;
};

export type DigitalDemandTemporalEnvelope = {
  readonly canonicalEntityId: string;
  readonly productRef: string | null;
  readonly inputFamily: DigitalDemandInputFamily;
  readonly geographicScope: 'GLOBAL' | 'COUNTRY' | 'REGION' | 'UNKNOWN';
  readonly aggregationGrain: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'UNKNOWN';
  readonly providerAvailabilityTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly vintageCapturedAt: UtcInstant;
  readonly revisionId: string;
  readonly revisionSequence: number;
  readonly sourceRefs: readonly DigitalDemandSourceRef[];
  readonly evidenceRefs: readonly string[];
  readonly qualityState: QualityState;
  /** Structural guarantee: observations are licensed/public aggregates only. */
  readonly aggregateOnly: true;
  readonly individualTrackingProhibited: true;
};
