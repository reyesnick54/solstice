/**
 * Information leakage guards for AAF04 point-in-time compilation.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  CorporateActionRevisionRow,
  TemporalObservation,
  TickerSymbolRow,
  UniverseMembershipRow,
} from '../temporal-types.ts';

export const LEAKAGE_REASON_CODES = [
  'FUTURE_OBSERVATION',
  'FUTURE_FILING_REVISION',
  'FUTURE_CONSTITUENT',
  'FUTURE_CORPORATE_ACTION',
  'UNPUBLISHED_FINANCIAL_PERIOD',
  'RESTATED_FUNDAMENTAL_AHEAD',
  'DELAYED_PROVIDER_NOT_KNOWABLE',
  'FORWARD_FILL_BEYOND_VALIDITY',
  'FUTURE_TICKER_METADATA',
] as const;

export type LeakageReasonCode = (typeof LEAKAGE_REASON_CODES)[number];

export type LeakageViolation = {
  readonly code: LeakageReasonCode;
  readonly message: string;
  readonly observationRef?: string;
};

function parseMs(at: UtcInstant): number {
  return Date.parse(at);
}

export function isKnowableAtDecision(decisionTime: UtcInstant, knowableAt: UtcInstant): boolean {
  const decisionMs = parseMs(decisionTime);
  const knowableMs = parseMs(knowableAt);
  if (!Number.isFinite(decisionMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  return decisionMs >= knowableMs;
}

export function assertObservationKnowable(
  observation: TemporalObservation,
  decisionTime: UtcInstant,
): LeakageViolation | null {
  if (!isKnowableAtDecision(decisionTime, observation.knowableAt)) {
    return Object.freeze({
      code: 'FUTURE_OBSERVATION',
      message: `observation ${observation.observationRef} knowable at ${observation.knowableAt} after decision ${decisionTime}`,
      observationRef: observation.observationRef,
    });
  }
  if (observation.validUntil && parseMs(decisionTime) > parseMs(observation.validUntil)) {
    return Object.freeze({
      code: 'FORWARD_FILL_BEYOND_VALIDITY',
      message: `observation ${observation.observationRef} validity ended ${observation.validUntil} before decision ${decisionTime}`,
      observationRef: observation.observationRef,
    });
  }
  if (
    observation.kind === 'FINANCIAL_STATEMENT_FACT' &&
    observation.periodEnd &&
    observation.publishedKnowableAt &&
    !isKnowableAtDecision(decisionTime, observation.publishedKnowableAt)
  ) {
    return Object.freeze({
      code: 'UNPUBLISHED_FINANCIAL_PERIOD',
      message: `financial period ending ${observation.periodEnd} not published knowable at ${decisionTime}`,
      observationRef: observation.observationRef,
    });
  }
  if (
    observation.kind === 'CORPORATE_FILING' &&
    observation.revisionSequence > 0 &&
    !isKnowableAtDecision(decisionTime, observation.knowableAt)
  ) {
    return Object.freeze({
      code: 'FUTURE_FILING_REVISION',
      message: `filing revision ${String(observation.revisionSequence)} not knowable at ${decisionTime}`,
      observationRef: observation.observationRef,
    });
  }
  if (observation.kind === 'ALT_DATA' && !isKnowableAtDecision(decisionTime, observation.knowableAt)) {
    return Object.freeze({
      code: 'DELAYED_PROVIDER_NOT_KNOWABLE',
      message: `alternative data ${observation.observationRef} not provider-knowable at ${decisionTime}`,
      observationRef: observation.observationRef,
    });
  }
  return null;
}

export function isUniverseMemberAt(row: UniverseMembershipRow, decisionTime: UtcInstant): boolean {
  if (!isKnowableAtDecision(decisionTime, row.enteredKnowableAt)) {
    return false;
  }
  if (row.leftKnowableAt && parseMs(decisionTime) >= parseMs(row.leftKnowableAt)) {
    return false;
  }
  return true;
}

/** Rejects constituent knowledge that could not exist at decisionTime. */
export function assertUniverseMembershipKnowable(
  row: UniverseMembershipRow,
  decisionTime: UtcInstant,
): LeakageViolation | null {
  return assertFutureConstituentLeak(row, decisionTime);
}

export function assertFutureConstituentLeak(
  row: UniverseMembershipRow,
  decisionTime: UtcInstant,
): LeakageViolation | null {
  if (parseMs(row.enteredKnowableAt) > parseMs(decisionTime)) {
    return Object.freeze({
      code: 'FUTURE_CONSTITUENT',
      message: `index membership for ${row.instrumentId} not knowable until ${row.enteredKnowableAt}`,
    });
  }
  return null;
}

export function assertCorporateActionKnowable(
  row: CorporateActionRevisionRow,
  decisionTime: UtcInstant,
): LeakageViolation | null {
  if (!isKnowableAtDecision(decisionTime, row.knowableAt)) {
    return Object.freeze({
      code: 'FUTURE_CORPORATE_ACTION',
      message: `corporate action ${row.actionId} revision ${String(row.revisionSequence)} not knowable at ${decisionTime}`,
    });
  }
  return null;
}

export function assertTickerKnowable(row: TickerSymbolRow, decisionTime: UtcInstant): LeakageViolation | null {
  if (!isKnowableAtDecision(decisionTime, row.effectiveKnowableAt)) {
    return Object.freeze({
      code: 'FUTURE_TICKER_METADATA',
      message: `ticker ${row.symbol} for ${row.instrumentId} not effective until ${row.effectiveKnowableAt}`,
    });
  }
  return null;
}

export function detectRestatementLeak(
  observations: readonly TemporalObservation[],
  decisionTime: UtcInstant,
): LeakageViolation | null {
  const fundamentals = observations.filter((row) => row.kind === 'FINANCIAL_STATEMENT_FACT');
  for (const row of fundamentals) {
    const later = fundamentals.find(
      (candidate) =>
        candidate.entityId === row.entityId &&
        candidate.periodEnd === row.periodEnd &&
        candidate.revisionSequence > row.revisionSequence &&
        isKnowableAtDecision(decisionTime, candidate.knowableAt) &&
        !isKnowableAtDecision(decisionTime, row.knowableAt),
    );
    if (later) {
      return Object.freeze({
        code: 'RESTATED_FUNDAMENTAL_AHEAD',
        message: `restated fundamental revision ${String(later.revisionSequence)} knowable while prior revision hidden at ${decisionTime}`,
        observationRef: later.observationRef,
      });
    }
  }
  return null;
}
