import type { UtcInstant } from '../../domain/src/time.ts';
import { newEgressDecisionId } from './ids.ts';
import { SIMULATION_THRESHOLDS, type EgressDecision } from './taxonomy.ts';
import type {
  CleanRoomFailure,
  EgressRecord,
  PrivacyThresholds,
  QueryAst,
  ReleasedResult,
} from './types.ts';
import { groupingDimensions } from './query.ts';

export function evaluateEgress(input: {
  readonly ast: QueryAst;
  readonly result: ReleasedResult | null;
  readonly cohortSize: number;
  readonly onwardSharing: boolean;
  readonly onwardSharingAllowed: boolean;
  readonly privacyPolicyVersion: EgressRecord['privacyPolicyVersion'];
  readonly now: UtcInstant;
  readonly jobId: EgressRecord['jobId'];
  readonly thresholds?: PrivacyThresholds;
  readonly uncertain?: boolean;
}): EgressRecord {
  const thresholds = input.thresholds ?? SIMULATION_THRESHOLDS;
  const dimensions = groupingDimensions(input.ast);
  const groups = input.result?.groups ?? [];
  const outputRowCount = groups.length > 0 ? groups.length : input.result ? 1 : 0;
  const raw = input.ast.rawRowExport === true;

  const deny = (code: CleanRoomFailure['code'], reason: string, decision: EgressDecision = 'DENY'): EgressRecord =>
    Object.freeze({
      decisionId: newEgressDecisionId(),
      jobId: input.jobId,
      decision,
      reasonCode: code,
      reason,
      cohortSize: input.cohortSize,
      outputRowCount,
      dimensions,
      rawRowExport: raw,
      privacyPolicyVersion: input.privacyPolicyVersion,
      onwardSharing: input.onwardSharing,
      occurredAt: input.now,
    });

  if (input.uncertain) {
    return deny('DEFAULT_DENY', 'egress defaults to DENY when the privacy decision is uncertain');
  }
  if (raw) {
    return deny('RAW_ROW_EXPORT_DENIED', 'RAW_ROW_EXPORT is default DENIED; aggregate consent is not row-level access');
  }
  if (input.onwardSharing && !input.onwardSharingAllowed) {
    return deny('DEFAULT_DENY', 'onward sharing is not permitted by the bound consent');
  }
  if (input.cohortSize < thresholds.minCohortSize) {
    return deny('COHORT_BELOW_THRESHOLD', `cohort ${input.cohortSize} is below engineering minimum ${thresholds.minCohortSize}`, 'SUPPRESS');
  }
  if (dimensions > thresholds.maxGroupingDimensions) {
    return deny('EXCESSIVE_DIMENSIONS', `grouping dimensions ${dimensions} exceed engineering maximum ${thresholds.maxGroupingDimensions}`);
  }
  if (outputRowCount > thresholds.maxOutputRowCount) {
    return deny('OUTPUT_CARDINALITY_EXCEEDED', `output rows ${outputRowCount} exceed engineering maximum ${thresholds.maxOutputRowCount}`, 'SUPPRESS');
  }
  for (const group of groups) {
    const cell = typeof group.count === 'number' ? group.count : input.cohortSize;
    if (cell > 0 && cell < thresholds.minCellSize) {
      return deny('CELL_BELOW_THRESHOLD', `cell size ${cell} is below engineering minimum ${thresholds.minCellSize}`, 'SUPPRESS');
    }
  }
  if (!input.result || input.result.shape !== 'AGGREGATE') {
    return deny('DEFAULT_DENY', 'only aggregate results may leave the Clean Room');
  }
  return Object.freeze({
    decisionId: newEgressDecisionId(),
    jobId: input.jobId,
    decision: 'RELEASE',
    reasonCode: 'ALLOWED',
    reason: 'aggregate-only result passed engineering cohort, cell, and cardinality controls',
    cohortSize: input.cohortSize,
    outputRowCount,
    dimensions,
    rawRowExport: false,
    privacyPolicyVersion: input.privacyPolicyVersion,
    onwardSharing: input.onwardSharing,
    occurredAt: input.now,
  });
}
