/**
 * AAFV2.3 explicit leakage scanner — canonical reason codes for Strategy Lab / Genome audits.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type {
  CorporateActionRevisionRow,
  TemporalObservation,
  TickerSymbolRow,
  UniverseMembershipRow,
} from '../temporal-types.ts';
import {
  assertCorporateActionKnowable,
  assertFutureConstituentLeak,
  assertTickerKnowable,
  detectRestatementLeak,
  type LeakageReasonCode,
  type LeakageViolation,
} from './leakage.ts';

export const AAFV2_03_LEAKAGE_REASON_CODES = [
  'FEATURE_AFTER_DECISION',
  'FILING_AFTER_DECISION',
  'REVISION_AFTER_DECISION',
  'ENTITY_MAPPING_AFTER_DECISION',
  'UNIVERSE_MEMBERSHIP_LEAK',
  'CORPORATE_ACTION_LEAK',
  'MACRO_RELEASE_LEAK',
  'ALTERNATIVE_DATA_LEAK',
  'SOURCE_ARRIVAL_LEAK',
] as const;

export type Aafv203LeakageReasonCode = (typeof AAFV2_03_LEAKAGE_REASON_CODES)[number];

export type LeakageViolationV2 = {
  readonly code: Aafv203LeakageReasonCode;
  readonly message: string;
  readonly observationRef?: string;
  readonly decisionTime?: UtcInstant;
};

export function mapLegacyLeakageToAafv203(
  violation: LeakageViolation,
  observation?: TemporalObservation | null,
): Aafv203LeakageReasonCode {
  const kind = observation?.kind;
  switch (violation.code) {
    case 'FUTURE_FILING_REVISION':
    case 'UNPUBLISHED_FINANCIAL_PERIOD':
      return kind === 'CORPORATE_FILING' ? 'FILING_AFTER_DECISION' : 'REVISION_AFTER_DECISION';
    case 'RESTATED_FUNDAMENTAL_AHEAD':
      return 'REVISION_AFTER_DECISION';
    case 'FUTURE_TICKER_METADATA':
      return 'ENTITY_MAPPING_AFTER_DECISION';
    case 'FUTURE_CONSTITUENT':
      return 'UNIVERSE_MEMBERSHIP_LEAK';
    case 'FUTURE_CORPORATE_ACTION':
      return 'CORPORATE_ACTION_LEAK';
    case 'DELAYED_PROVIDER_NOT_KNOWABLE':
      return kind === 'ALT_DATA' ? 'ALTERNATIVE_DATA_LEAK' : 'SOURCE_ARRIVAL_LEAK';
    case 'FORWARD_FILL_BEYOND_VALIDITY':
      return 'FEATURE_AFTER_DECISION';
    case 'FUTURE_OBSERVATION':
    default:
      if (kind === 'MACRO_RELEASE') {
        return 'MACRO_RELEASE_LEAK';
      }
      if (kind === 'ALT_DATA') {
        return 'ALTERNATIVE_DATA_LEAK';
      }
      if (kind === 'CORPORATE_FILING') {
        return 'FILING_AFTER_DECISION';
      }
      if (kind === 'CORPORATE_ACTION') {
        return 'CORPORATE_ACTION_LEAK';
      }
      if (kind === 'REFERENCE_METADATA') {
        return 'ENTITY_MAPPING_AFTER_DECISION';
      }
      if (kind === 'MARKET_BAR') {
        const providerDelayed =
          observation?.metadata.provider !== undefined ||
          violation.message.toLowerCase().includes('provider') ||
          violation.message.toLowerCase().includes('delayed');
        return providerDelayed ? 'SOURCE_ARRIVAL_LEAK' : 'FEATURE_AFTER_DECISION';
      }
      return 'FEATURE_AFTER_DECISION';
  }
}

export function toLeakageViolationV2(
  violation: LeakageViolation,
  decisionTime: UtcInstant,
  observation?: TemporalObservation | null,
): LeakageViolationV2 {
  return Object.freeze({
    code: mapLegacyLeakageToAafv203(violation, observation),
    message: violation.message,
    ...(violation.observationRef !== undefined ? { observationRef: violation.observationRef } : {}),
    decisionTime,
  });
}

export type LeakageScanInput = {
  readonly decisionTime: UtcInstant;
  readonly observations: readonly TemporalObservation[];
  readonly universeMembership: readonly UniverseMembershipRow[];
  readonly tickerHistory: readonly TickerSymbolRow[];
  readonly corporateActionRevisions: readonly CorporateActionRevisionRow[];
  readonly instrumentId?: string;
  readonly indexId?: string;
};

export function scanPointInTimeLeakage(input: LeakageScanInput): LeakageViolationV2 | null {
  const restatement = detectRestatementLeak(input.observations, input.decisionTime);
  if (restatement) {
    return toLeakageViolationV2(restatement, input.decisionTime);
  }

  for (const row of input.universeMembership) {
    if (input.indexId && row.indexId !== input.indexId) {
      continue;
    }
    if (input.instrumentId && row.instrumentId !== input.instrumentId) {
      continue;
    }
    const leak = assertFutureConstituentLeak(row, input.decisionTime);
    if (leak) {
      return toLeakageViolationV2(leak, input.decisionTime);
    }
  }

  for (const row of input.tickerHistory) {
    if (input.instrumentId && row.instrumentId !== input.instrumentId) {
      continue;
    }
    const leak = assertTickerKnowable(row, input.decisionTime);
    if (leak) {
      return toLeakageViolationV2(leak, input.decisionTime);
    }
  }

  for (const row of input.corporateActionRevisions) {
    if (input.instrumentId && row.instrumentId !== input.instrumentId) {
      continue;
    }
    const leak = assertCorporateActionKnowable(row, input.decisionTime);
    if (leak) {
      return toLeakageViolationV2(leak, input.decisionTime);
    }
  }

  return null;
}

export function legacyCodeToAafv203(code: LeakageReasonCode): Aafv203LeakageReasonCode {
  return mapLegacyLeakageToAafv203({ code, message: code });
}
