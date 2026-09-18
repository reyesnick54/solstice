import type { UtcInstant } from '../../../../domain/src/time.ts';
import { triggerEventIdFor } from './ids.ts';
import {
  APPROVED_HELIOS_REPORTING_POLICY,
  findPolicyObligationsForTrigger,
  type ApprovedPolicyObligationRef,
} from './reporting-policy.ts';
import type {
  ReportabilityDetermination,
  ReportingTriggerCategory,
} from './taxonomy.ts';
import type { TriggerDetectionInput, TriggerEvent } from './types.ts';

export type TriggerEvaluationResult = {
  readonly trigger: TriggerEvent;
  readonly matchedObligations: readonly ApprovedPolicyObligationRef[];
  readonly reportability: ReportabilityDetermination;
};

function reportabilityFromMatches(
  matches: readonly ApprovedPolicyObligationRef[],
): ReportabilityDetermination {
  if (matches.length === 0) {
    return 'NOT_REPORTABLE';
  }
  if (matches.some((m) => m.mappingStatus === 'UNMAPPED')) {
    return 'UNMAPPED';
  }
  if (matches.some((m) => m.mappingStatus === 'LEGAL_REVIEW_REQUIRED')) {
    return 'LEGAL_REVIEW_REQUIRED';
  }
  if (matches.some((m) => m.mappingStatus === 'APPROVED')) {
    return 'POTENTIALLY_REPORTABLE';
  }
  return 'NOT_REPORTABLE';
}

export function detectReportingTrigger(input: TriggerDetectionInput): TriggerEvaluationResult {
  const triggerEventId = triggerEventIdFor(input.sourceEventId, input.triggerCategory);
  const trigger: TriggerEvent = Object.freeze({
    triggerEventId,
    traceId: input.traceId,
    sourceEventId: input.sourceEventId,
    sourceEventKind: input.sourceEventKind,
    triggerCategory: input.triggerCategory,
    customerId: input.customerId,
    jurisdiction: input.jurisdiction,
    productActivity: input.productActivity,
    detectedAt: input.now,
    idempotencyKey: input.idempotencyKey,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });

  const matchedObligations = findPolicyObligationsForTrigger(
    input.triggerCategory,
    input.jurisdiction,
    input.productActivity,
  );

  return Object.freeze({
    trigger,
    matchedObligations,
    reportability: reportabilityFromMatches(matchedObligations),
  });
}

export function computeDueAt(
  obligation: ApprovedPolicyObligationRef,
  eventAt: UtcInstant,
): UtcInstant | null {
  if (obligation.dueRuleKind !== 'APPROVED_POLICY_OFFSET' || obligation.dueOffsetDays === null) {
    return null;
  }
  const base = new Date(eventAt);
  base.setUTCDate(base.getUTCDate() + obligation.dueOffsetDays);
  return base.toISOString() as UtcInstant;
}

export function reportingPolicyVersion(): string {
  return APPROVED_HELIOS_REPORTING_POLICY.policyVersion;
}

export function isThresholdReportable(notionalMinorUnits: string, thresholdMinorUnits: string): boolean {
  try {
    return BigInt(notionalMinorUnits) >= BigInt(thresholdMinorUnits);
  } catch {
    return false;
  }
}

export function classifyOrderEvent(
  notionalMinorUnits: string,
  thresholdMinorUnits = '500000000',
): ReportingTriggerCategory {
  if (isThresholdReportable(notionalMinorUnits, thresholdMinorUnits)) {
    return 'THRESHOLD_REPORTABLE_ACTIVITY';
  }
  return 'ORDER_TRADING_EVENT';
}
