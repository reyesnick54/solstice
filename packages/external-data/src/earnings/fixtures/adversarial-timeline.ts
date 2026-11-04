/**
 * Deterministic earnings lifecycle fixture — reschedule, early/late release, amendment, duplicates.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { earningsEventKey, parseFiscalPeriodLabel } from '../identity.ts';
import { classifyEarningsSessionTiming } from '../session-timing.ts';
import type { EarningsExternalObservation } from '../types.ts';
import { createHash } from 'node:crypto';

export const ADVERSARIAL_ENTITY_ID = 'sunrey:company:us:0000888888';
export const ADVERSARIAL_FISCAL = parseFiscalPeriodLabel('FY2025Q1');
export const ADVERSARIAL_EVENT_KEY = earningsEventKey({
  canonicalEntityId: ADVERSARIAL_ENTITY_ID,
  fiscal: ADVERSARIAL_FISCAL,
});

function obs(
  partial: Omit<EarningsExternalObservation, 'schema' | 'grantsExecutionAuthority' | 'fiscal' | 'earningsEventKey' | 'canonicalEntityId'>,
): EarningsExternalObservation {
  return Object.freeze({
    schema: 'sunrey.external.earnings-observation.v1',
    canonicalEntityId: ADVERSARIAL_ENTITY_ID,
    earningsEventKey: ADVERSARIAL_EVENT_KEY,
    fiscal: ADVERSARIAL_FISCAL,
    grantsExecutionAuthority: false,
    ...partial,
  });
}

function hashRef(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/** Calendar initially schedules AMC; later reschedules to BMO — lineage preserved via rescheduledFromEventKey. */
export const CALENDAR_INITIAL_SCHEDULE = obs({
  observationId: 'cal:adv:schedule:v1',
  artifactKind: 'EXPECTED_EVENT',
  times: Object.freeze({
    scheduledEventTime: asUtcInstant('2025-04-28T20:00:00.000Z'),
    confirmedEventTime: null,
    actualReleaseTime: null,
    secAcceptedTime: null,
    callStartTime: null,
    providerAvailabilityTime: asUtcInstant('2025-03-01T12:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2025-03-01T12:00:00.000Z'),
    knowableAt: asUtcInstant('2025-03-01T12:00:00.000Z'),
  }),
  sessionTiming: 'AFTER_MARKET',
  provenance: Object.freeze({
    providerId: 'fixture-calendar',
    providerKind: 'EARNINGS_CALENDAR',
    sourceId: 'cal-adv-v1',
    evidenceRef: 'fixture:calendar:adv:v1',
    rawPayloadHash: hashRef(['cal', 'v1']),
    dedupeKey: 'fixture:calendar:adv:schedule:v1',
  }),
  lineageRootId: 'cal:adv:schedule:v1',
  supersedesObservationId: null,
  rescheduledFromEventKey: null,
  secForm: null,
  sec8kItem: null,
  accessionNumber: null,
  filingId: null,
  payload: Object.freeze({ note: 'initial AMC schedule' }),
});

export const CALENDAR_RESCHEDULE = obs({
  observationId: 'cal:adv:schedule:v2',
  artifactKind: 'CONFIRMED_ANNOUNCEMENT',
  times: Object.freeze({
    scheduledEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    confirmedEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    actualReleaseTime: null,
    secAcceptedTime: null,
    callStartTime: asUtcInstant('2025-04-29T13:30:00.000Z'),
    providerAvailabilityTime: asUtcInstant('2025-04-10T08:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2025-04-10T08:00:00.000Z'),
    knowableAt: asUtcInstant('2025-04-10T08:00:00.000Z'),
  }),
  sessionTiming: classifyEarningsSessionTiming(asUtcInstant('2025-04-29T12:30:00.000Z')),
  provenance: Object.freeze({
    providerId: 'fixture-calendar',
    providerKind: 'EARNINGS_CALENDAR',
    sourceId: 'cal-adv-v2',
    evidenceRef: 'fixture:calendar:adv:v2',
    rawPayloadHash: hashRef(['cal', 'v2']),
    dedupeKey: 'fixture:calendar:adv:schedule:v2',
  }),
  lineageRootId: 'cal:adv:schedule:v1',
  supersedesObservationId: 'cal:adv:schedule:v1',
  rescheduledFromEventKey: null,
  secForm: null,
  sec8kItem: null,
  accessionNumber: null,
  filingId: null,
  payload: Object.freeze({ note: 'rescheduled to BMO' }),
});

/** IR early release — knowable before calendar confirmed time. */
export const IR_EARLY_RELEASE = obs({
  observationId: 'ir:adv:release:early',
  artifactKind: 'EARNINGS_RELEASE',
  times: Object.freeze({
    scheduledEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    confirmedEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    actualReleaseTime: asUtcInstant('2025-04-29T11:55:00.000Z'),
    secAcceptedTime: null,
    callStartTime: null,
    providerAvailabilityTime: asUtcInstant('2025-04-29T11:55:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2025-04-29T11:56:00.000Z'),
    knowableAt: asUtcInstant('2025-04-29T11:56:00.000Z'),
  }),
  sessionTiming: classifyEarningsSessionTiming(asUtcInstant('2025-04-29T11:55:00.000Z')),
  provenance: Object.freeze({
    providerId: 'fixture-ir',
    providerKind: 'ISSUER_IR',
    sourceId: 'ir-adv-early',
    evidenceRef: 'fixture:ir:adv:early',
    rawPayloadHash: hashRef(['ir', 'early']),
    dedupeKey: 'fixture:ir:adv:release',
  }),
  lineageRootId: 'ir:adv:release:early',
  supersedesObservationId: null,
  rescheduledFromEventKey: null,
  secForm: null,
  sec8kItem: null,
  accessionNumber: null,
  filingId: null,
  payload: Object.freeze({ headline: 'Q1 results' }),
});

/** SEC 8-K accepted after IR — must not leak before knowableAt. */
export const SEC_8K_RELEASE = obs({
  observationId: 'sec:adv:8k:original',
  artifactKind: 'SEC_8K_2_02',
  times: Object.freeze({
    scheduledEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    confirmedEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    actualReleaseTime: asUtcInstant('2025-04-29T21:05:00.000Z'),
    secAcceptedTime: asUtcInstant('2025-04-29T21:10:00.000Z'),
    callStartTime: null,
    providerAvailabilityTime: asUtcInstant('2025-04-29T21:10:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2025-04-29T21:11:00.000Z'),
    knowableAt: asUtcInstant('2025-04-29T21:11:00.000Z'),
  }),
  sessionTiming: classifyEarningsSessionTiming(asUtcInstant('2025-04-29T21:05:00.000Z')),
  provenance: Object.freeze({
    providerId: 'sec-edgar',
    providerKind: 'SEC_EDGAR',
    sourceId: '0000888888-25-000001',
    evidenceRef: 'sec-edgar:0000888888-25-000001',
    rawPayloadHash: hashRef(['8k', 'original']),
    dedupeKey: '0000888888-25-000001:SEC_8K_2_02',
  }),
  lineageRootId: 'sec:adv:8k:original',
  supersedesObservationId: null,
  rescheduledFromEventKey: null,
  secForm: '8-K',
  sec8kItem: '2.02',
  accessionNumber: '0000888888-25-000001',
  filingId: 'adv-fy2025q1-8k',
  payload: Object.freeze({ item: '2.02' }),
});

export const SEC_8K_AMENDMENT = obs({
  observationId: 'sec:adv:8k:amended',
  artifactKind: 'SEC_8K_2_02',
  times: Object.freeze({
    scheduledEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    confirmedEventTime: asUtcInstant('2025-04-29T12:30:00.000Z'),
    actualReleaseTime: asUtcInstant('2025-04-29T21:05:00.000Z'),
    secAcceptedTime: asUtcInstant('2025-05-02T16:00:00.000Z'),
    callStartTime: null,
    providerAvailabilityTime: asUtcInstant('2025-05-02T16:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2025-05-02T16:01:00.000Z'),
    knowableAt: asUtcInstant('2025-05-02T16:01:00.000Z'),
  }),
  sessionTiming: classifyEarningsSessionTiming(asUtcInstant('2025-04-29T21:05:00.000Z')),
  provenance: Object.freeze({
    providerId: 'sec-edgar',
    providerKind: 'SEC_EDGAR',
    sourceId: '0000888888-25-000002',
    evidenceRef: 'sec-edgar:0000888888-25-000002',
    rawPayloadHash: hashRef(['8k', 'amended']),
    dedupeKey: '0000888888-25-000002:SEC_8K_2_02',
  }),
  lineageRootId: 'sec:adv:8k:original',
  supersedesObservationId: 'sec:adv:8k:original',
  rescheduledFromEventKey: null,
  secForm: '8-K/A',
  sec8kItem: '2.02',
  accessionNumber: '0000888888-25-000002',
  filingId: 'adv-fy2025q1-8k-a',
  payload: Object.freeze({ item: '2.02', amended: 'true' }),
});

/** Duplicate provider report — same dedupe key as IR release. */
export const IR_DUPLICATE_RELEASE = obs({
  ...IR_EARLY_RELEASE,
  observationId: 'ir:adv:release:dup',
  provenance: Object.freeze({
    ...IR_EARLY_RELEASE.provenance,
    sourceId: 'ir-adv-dup',
    evidenceRef: 'fixture:ir:adv:dup',
    rawPayloadHash: hashRef(['ir', 'dup']),
  }),
  times: Object.freeze({
    ...IR_EARLY_RELEASE.times,
    sunreyArrivalTime: asUtcInstant('2025-04-29T12:00:00.000Z'),
    knowableAt: asUtcInstant('2025-04-29T12:00:00.000Z'),
  }),
});

export const ADVERSARIAL_EARNINGS_TIMELINE = Object.freeze([
  CALENDAR_INITIAL_SCHEDULE,
  CALENDAR_RESCHEDULE,
  IR_EARLY_RELEASE,
  SEC_8K_RELEASE,
  SEC_8K_AMENDMENT,
  IR_DUPLICATE_RELEASE,
]);
