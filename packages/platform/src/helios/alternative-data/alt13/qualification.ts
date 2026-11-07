/**
 * HELIOS ALT13 — qualification gate.
 */

import { buildAlt13IncrementalInformationEvidence } from './evidence.ts';
import {
  HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
  HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED,
} from './taxonomy.ts';
import type { Alt13IncrementalInformationEvidence } from './types.ts';

export type Alt13QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | typeof HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED
    | typeof HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED;
  readonly evidence: Alt13IncrementalInformationEvidence;
  readonly blockers: readonly string[];
};

export function evaluateAlt13IncrementalInformationQualification(): Alt13QualificationResult {
  const evidence = buildAlt13IncrementalInformationEvidence();
  const blockers = [...evidence.blockers];

  if (evidence.hypotheses.length === 0) {
    blockers.push('no_hypotheses_registered');
  }
  if (evidence.incrementalStates.length !== evidence.hypotheses.length) {
    blockers.push('incremental_state_mismatch');
  }
  if (evidence.redundancyState.grantsExecutionAuthority) {
    blockers.push('execution_authority_leak');
  }
  if (evidence.multipleTesting.trialCount < evidence.hypotheses.length) {
    blockers.push('trial_registry_incomplete');
  }

  const qualified =
    blockers.length === 0 &&
    evidence.qualificationMarker === HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED;

  return Object.freeze({
    qualified,
    marker: qualified
      ? HELIOS_ALT13_INCREMENTAL_INFORMATION_QUALIFIED
      : HELIOS_ALT13_INCREMENTAL_INFORMATION_BLOCKED,
    evidence,
    blockers: Object.freeze(blockers),
  });
}
