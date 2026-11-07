import {
  HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED,
  HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED, HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED };

export type Exec03QualificationChecks = {
  readonly persistsBeforeExternalSubmit: boolean;
  readonly timeoutMarksSubmissionUnknown: boolean;
  readonly blindResubmitRefused: boolean;
  readonly reconciliationBeforeRetry: boolean;
  readonly safeWindowBeforeNotFound: boolean;
  readonly governedResubmitAfterSafeNotFound: boolean;
  readonly restartReconcilesIncomplete: boolean;
  readonly exactlyOneExternalOrderOnTimeoutAccept: boolean;
  readonly clientOrderIdGloballyUnique: boolean;
  readonly idempotencyPayloadHashEnforced: boolean;
  readonly liveBrokerConnected: false;
};

export function evaluateExec03ExactlyOnceQualification(checks: Exec03QualificationChecks): {
  readonly marker:
    | typeof HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED
    | typeof HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
} {
  const entries = Object.entries(checks) as [keyof Exec03QualificationChecks, boolean | false][];
  const blockers = entries
    .filter(([key, passed]) => key !== 'liveBrokerConnected' && passed !== true)
    .map(([key]) => key);
  if (checks.liveBrokerConnected !== false) {
    blockers.push('liveBrokerConnected');
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EXEC03_EXACTLY_ONCE_INTENT_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EXEC03_EXACTLY_ONCE_INTENT_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
