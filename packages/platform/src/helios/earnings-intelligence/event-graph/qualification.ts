/**
 * HELIOS EARN02 qualification gate.
 */

import {
  HELIOS_EARN02_EVENT_GRAPH_BLOCKED,
  HELIOS_EARN02_EVENT_GRAPH_QUALIFIED,
} from './taxonomy.ts';

export type Earn02QualificationChecks = {
  readonly futureReleaseCannotLeak: boolean;
  readonly revisedReleasePreservesPriorState: boolean;
  readonly rescheduledEventRetainsLineage: boolean;
  readonly sessionTimingClassificationCorrect: boolean;
  readonly amendedFilingDoesNotRewriteHistory: boolean;
  readonly duplicateProviderReportsDedupe: boolean;
};

export type Earn02QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN02_EVENT_GRAPH_QUALIFIED
    | typeof HELIOS_EARN02_EVENT_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn02Qualification(checks: Earn02QualificationChecks): Earn02QualificationResult {
  const blockers: string[] = [];
  if (!checks.futureReleaseCannotLeak) blockers.push('future release leak');
  if (!checks.revisedReleasePreservesPriorState) blockers.push('revised release prior state not preserved');
  if (!checks.rescheduledEventRetainsLineage) blockers.push('reschedule lineage missing');
  if (!checks.sessionTimingClassificationCorrect) blockers.push('session timing classification incorrect');
  if (!checks.amendedFilingDoesNotRewriteHistory) blockers.push('amended filing rewrote history');
  if (!checks.duplicateProviderReportsDedupe) blockers.push('duplicate provider reports not deduped');

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_EARN02_EVENT_GRAPH_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_EARN02_EVENT_GRAPH_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
