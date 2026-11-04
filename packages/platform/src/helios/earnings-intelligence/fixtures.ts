/**
 * Simulation fixtures for EARN01 domain qualification (not production data).
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { EarningsEvent, EarningsActualObservation, EarningsConsensusSnapshot } from './types.ts';
import { asEarningsEventId } from './types.ts';
import {
  HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY,
  HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';

const ENTITY = 'entity.simcorp.demo';
const INSTRUMENT = 'instrument.simcorp.demo';

export function demoFiscalPeriodQ2_2024() {
  return Object.freeze({
    fiscalYear: 2024,
    fiscalQuarter: 2 as const,
    periodLabel: 'FY2024-Q2',
    periodEndDate: '2024-06-30',
  });
}

function baseTemporal(knowableAt: UtcInstant) {
  return Object.freeze({
    canonicalEntityId: ENTITY,
    canonicalInstrumentId: INSTRUMENT,
    fiscalPeriod: demoFiscalPeriodQ2_2024(),
    eventTime: asUtcInstant('2024-08-15T21:00:00.000Z'),
    publishedTime: asUtcInstant('2024-08-15T21:05:00.000Z'),
    providerAvailabilityTime: asUtcInstant('2024-08-15T21:04:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2024-08-15T21:06:00.000Z'),
    knowableAt,
    revisionId: null,
    sourceRefs: Object.freeze([
      Object.freeze({
        sourceId: 'fixture.earnings.vendor',
        providerId: 'simulation.earnings',
        capability: 'earnings.release',
        upstreamRef: null,
      }),
    ]),
    evidenceRefs: Object.freeze(['evidence.fixture.earnings.demo']),
    qualityState: 'VALID' as const,
  });
}

export function demoEarningsEventReleased(input?: { readonly knowableAt?: UtcInstant }): EarningsEvent {
  const knowableAt = input?.knowableAt ?? asUtcInstant('2024-08-15T21:06:00.000Z');
  return Object.freeze({
    schema: HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
    authority: HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY,
    eventId: asEarningsEventId('earn.event.simcorp.fy2024q2'),
    announcementState: 'RELEASED',
    sessionClassification: 'AFTER_MARKET',
    scheduledReleaseTime: asUtcInstant('2024-08-15T21:00:00.000Z'),
    confirmedReleaseTime: asUtcInstant('2024-08-15T21:00:00.000Z'),
    earningsCallScheduledTime: asUtcInstant('2024-08-16T14:00:00.000Z'),
    earningsCallCompletedTime: null,
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
    ...baseTemporal(knowableAt),
  });
}

export function demoConsensusBeforeRelease(): EarningsConsensusSnapshot {
  return Object.freeze({
    observationKind: 'consensus',
    snapshotId: 'earn.consensus.simcorp.fy2024q2.pre',
    eventId: asEarningsEventId('earn.event.simcorp.fy2024q2'),
    metrics: Object.freeze([
      Object.freeze({
        metricId: 'eps',
        unit: 'USD/share_minor',
        valueMinor: 125n,
        valueText: null,
      }),
    ]),
    analystCount: 12,
    grantsExecutionAuthority: false,
    ...baseTemporal(asUtcInstant('2024-08-14T23:59:59.000Z')),
  });
}

export function demoActualAfterRelease(): EarningsActualObservation {
  return Object.freeze({
    observationKind: 'actual',
    observationId: 'earn.actual.simcorp.fy2024q2',
    eventId: asEarningsEventId('earn.event.simcorp.fy2024q2'),
    metrics: Object.freeze([
      Object.freeze({
        metricId: 'eps',
        unit: 'USD/share_minor',
        valueMinor: 132n,
        valueText: null,
      }),
    ]),
    grantsExecutionAuthority: false,
    ...baseTemporal(asUtcInstant('2024-08-15T21:06:00.000Z')),
  });
}

/** Actual with knowableAt after public release — must stay hidden until knowable. */
export function demoFutureLeakingActual(): EarningsActualObservation {
  return Object.freeze({
    ...demoActualAfterRelease(),
    observationId: 'earn.actual.simcorp.fy2024q2.leak',
    knowableAt: asUtcInstant('2024-08-16T12:00:00.000Z'),
  });
}
