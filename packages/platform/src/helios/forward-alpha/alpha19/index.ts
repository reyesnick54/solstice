/**
 * HELIOS FORWARD ALPHA — ALPHA19 outcome maturity and delayed label engine.
 */

export {
  HELIOS_ALPHA19_WORK_PACKAGE,
  HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
  HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED,
  HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED,
  CANONICAL_OUTCOME_HORIZON_IDS,
  OUTCOME_RESOLUTION_STATUSES,
  OUTCOME_REALIZED_LABELS,
  type CanonicalOutcomeHorizonId,
  type OutcomeResolutionStatus,
  type OutcomeRealizedLabel,
} from './taxonomy.ts';

export type {
  OutcomeMaturitySchedule,
  OutcomeObservationWindow,
  PendingOutcome,
  MaturedOutcome,
  MaturedOutcomeSeal,
  OutcomeSealedDecisionBinding,
  OutcomeEvidenceUpdateRecord,
  OutcomeMaturityQueueState,
  OutcomeMaturityEngineFailure,
  OutcomeMaturityEngineFailureCode,
} from './types.ts';

export {
  CANONICAL_OUTCOME_HORIZON_MS,
  horizonMsForId,
  assertKnownHorizonId,
} from './horizons.ts';

export { buildOutcomeObservationWindow, maturityInstant } from './window.ts';

export { sealOutcomeMaturitySchedule } from './schedule.ts';

export {
  computeOutcomeObservationSlice,
  assertNoPartialFuturePathInSlice,
  sealMaturedOutcome,
  type OutcomeObservationSlice,
} from './outcome.ts';

export { OutcomeMaturityQueueStore } from './store.ts';

export {
  createOutcomeMaturityQueueStore,
  enqueuePendingOutcomesForDecision,
  attemptMaturePendingOutcome,
  processDueOutcomeMaturityJobs,
  initialQueueState,
  type OutcomeMaturityAttemptResult,
} from './engine.ts';

export {
  evaluateAlpha19OutcomeMaturityQualification,
  validatePendingOutcomeInvariants,
  validateMaturedOutcomeInvariants,
  type Alpha19QualificationChecks,
  type Alpha19QualificationResult,
} from './qualification.ts';

export {
  alpha19ScheduleFixture,
  alpha19DecisionBindingFixture,
  alpha19ObservationStream,
} from './fixtures.ts';
