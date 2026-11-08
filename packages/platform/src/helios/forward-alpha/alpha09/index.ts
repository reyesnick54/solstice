/**
 * HELIOS Forward Alpha — ALPHA09 risk-adjusted return and tail evidence.
 */

export {
  ALPHA09_HORIZON_CLASSES,
  ALPHA09_SINGLE_SLICE_DOMINANCE_BPS,
  ALPHA09_TAIL_CONFIDENCE_BPS,
  ALPHA09_TOP5_TRADES_DOMINANCE_BPS,
  ALPHA09_TRACK_RECORD_POLICIES,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_BLOCKED,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA09_SCHEMA,
  type Alpha09HorizonClass,
  type Alpha09MinimumTrackRecordPolicy,
} from './taxonomy.ts';

export type {
  Alpha09PeriodReturnUnits,
  ForwardAlpha09ConcentrationState,
  ForwardAlpha09MeasureInput,
  ForwardAlpha09RiskAdjustedEvidence,
  ForwardAlpha09TrackRecordAssessment,
  ForwardAlpha09TradeObservation,
  ForwardPerformanceState,
  ForwardRiskState,
  ForwardTailState,
} from './types.ts';

export { measureForwardPerformance, measureForwardRisk, measureForwardTail } from './measure.ts';
export { analyzeForwardAlphaConcentration } from './concentration.ts';
export { assessForwardAlphaTrackRecord } from './track-record.ts';
export { runForwardAlpha09RiskAdjustedEvidence } from './engine.ts';
export {
  evaluateForwardAlpha09Qualification,
  checksFromEvidence,
  type Alpha09QualificationChecks,
  type Alpha09QualificationResult,
} from './qualification.ts';
export { fixtureAlpha09ConcentratedInput, fixtureAlpha09DiversifiedInput } from './fixtures.ts';
