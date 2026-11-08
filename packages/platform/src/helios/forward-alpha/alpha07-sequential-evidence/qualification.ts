/**
 * ALPHA07 — qualification for anytime-valid sequential evidence engine.
 */

import {
  ALPHA07_RULE_FLAGS,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
} from './taxonomy.ts';
import type { SequentialAlphaEvidence } from './types.ts';

export { HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED, HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED };

export type Alpha07SequentialEvidenceQualificationResult = {
  readonly marker:
    | typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED
    | typeof HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export type Alpha07SequentialEvidenceQualificationChecks = {
  readonly evidence: SequentialAlphaEvidence;
  readonly boundsPredeclared: boolean;
  readonly offlineDiagnosticsPresent: boolean;
};

export function evaluateAlpha07SequentialEvidenceQualification(
  checks: Alpha07SequentialEvidenceQualificationChecks,
): Alpha07SequentialEvidenceQualificationResult {
  const blockers: string[] = [];
  const ev = checks.evidence;

  if (ev.schema !== HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA) {
    blockers.push('schema_mismatch');
  }
  if (!checks.boundsPredeclared) {
    blockers.push('return_bounds_not_predeclared');
  }
  if (!checks.offlineDiagnosticsPresent) {
    blockers.push('offline_diagnostics_missing');
  }
  if (!ALPHA07_RULE_FLAGS.SEQUENTIAL_ONLY_WHEN_ASSUMPTIONS_SATISFIED) {
    blockers.push('rule_flags_corrupt');
  }
  if (ev.sequentialInferenceActive && ev.dependenceAssumption === 'ASSUMPTIONS_FAILED') {
    blockers.push('sequential_active_under_failed_assumptions');
  }
  if (
    ev.sequentialInferenceActive &&
    (ev.lowerConfidenceBound === null || ev.upperConfidenceBound === null)
  ) {
    blockers.push('sequential_bounds_missing');
  }
  if (ev.offlineDiagnostics.note !== 'OFFLINE_POST_HOC_NOT_ANYTIME_VALID') {
    blockers.push('offline_diagnostics_not_labeled');
  }

  const uniq = Object.freeze(Array.from(new Set(blockers)));
  const qualified = uniq.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED
      : HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED,
    qualified,
    blockers: uniq,
  });
}
