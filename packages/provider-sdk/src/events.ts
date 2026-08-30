/**
 * Provider data quality events.
 * Uses the canonical events taxonomy — not a separate event bus.
 */

import type { UtcInstant } from '../../domain/src/time.ts';
import type { VersionedEvent } from '../../events/src/events.ts';
import type { FreshnessStatus, ValidationStatus } from './types.ts';

export const PROVIDER_DATA_QUALITY_EVENT_TYPES = [
  'ProviderDataInvalid',
  'ProviderDataStale',
  'ProviderSchemaChanged',
  'ProviderDataOutlier',
  'ProviderPayloadDuplicate',
] as const;
export type ProviderDataQualityEventType = (typeof PROVIDER_DATA_QUALITY_EVENT_TYPES)[number];

export type ProviderDataQualityPayload = {
  readonly providerId: string;
  readonly capability: string;
  readonly dataset: string;
  readonly observationId: string | null;
  readonly requestId: string | null;
  readonly rawPayloadHash: string | null;
  readonly freshnessStatus: FreshnessStatus | null;
  readonly validationStatus: ValidationStatus | null;
  readonly detail: string;
};

export type ProviderDataInvalidV1 = VersionedEvent<'ProviderDataInvalid', 1, ProviderDataQualityPayload>;
export type ProviderDataStaleV1 = VersionedEvent<'ProviderDataStale', 1, ProviderDataQualityPayload>;
export type ProviderSchemaChangedV1 = VersionedEvent<'ProviderSchemaChanged', 1, ProviderDataQualityPayload>;
export type ProviderDataOutlierV1 = VersionedEvent<'ProviderDataOutlier', 1, ProviderDataQualityPayload>;
export type ProviderPayloadDuplicateV1 = VersionedEvent<
  'ProviderPayloadDuplicate',
  1,
  ProviderDataQualityPayload
>;

export type ProviderDataQualityEvent =
  | ProviderDataInvalidV1
  | ProviderDataStaleV1
  | ProviderSchemaChangedV1
  | ProviderDataOutlierV1
  | ProviderPayloadDuplicateV1;

export function createProviderDataQualityEvent(
  eventType: ProviderDataQualityEventType,
  occurredAt: UtcInstant,
  payload: ProviderDataQualityPayload,
): ProviderDataQualityEvent {
  return Object.freeze({
    eventType,
    schemaVersion: 1 as const,
    occurredAt,
    payload: Object.freeze(payload),
  });
}
