/**
 * HELIOS FORWARD ALPHA — ALPHA07 anytime-valid sequential evidence engine.
 */

export {
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
  RETURN_DEPENDENCE_ASSUMPTIONS,
  SEQUENTIAL_EVIDENCE_METHODS,
  ALPHA07_RULE_FLAGS,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_BLOCKED,
  type ReturnDependenceAssumption,
  type SequentialEvidenceMethod,
} from './taxonomy.ts';

export type {
  PredeclaredReturnBounds,
  ConfidenceSequenceState,
  EProcessState,
  SequentialTrackedMetrics,
  AnytimeValidComparison,
  SequentialModelConfidenceSet,
  OfflineAlphaDiagnostics,
  SequentialAlphaEvidence,
  SequentialObservation,
  SequentialEvidenceCampaignConfig,
} from './types.ts';

export {
  lag1Autocorrelation,
  assessReturnDependence,
  assertValidAssumption,
} from './dependence.ts';

export {
  boundedConfidenceSequenceWidth,
  selectSequentialMethod,
  buildConfidenceSequenceState,
} from './confidence-sequence.ts';

export { eProcessMeanExcess } from './e-process.ts';

export { buildOfflineAlphaDiagnostics } from './offline-diagnostics.ts';

export { buildAnytimeValidComparison } from './comparison.ts';

export {
  validateObservationAgainstBounds,
  excessReturnBounds,
  buildSequentialModelConfidenceSet,
  evaluateSequentialAlphaEvidence,
} from './engine.ts';

export {
  evaluateAlpha07SequentialEvidenceQualification,
  type Alpha07SequentialEvidenceQualificationChecks,
  type Alpha07SequentialEvidenceQualificationResult,
} from './qualification.ts';

export {
  ALPHA07_FIXTURE_REGISTERED_AT,
  ALPHA07_FIXTURE_BOUNDS,
  ALPHA07_FIXTURE_OBSERVATIONS,
  ALPHA07_AUTOCORR_FIXTURE_OBSERVATIONS,
} from './fixtures.ts';
