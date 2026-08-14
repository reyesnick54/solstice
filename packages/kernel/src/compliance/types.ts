import type { DecisionStatus } from '../../../permissions/src/decision.ts';

/**
 * Canonical screening outcomes. Provider scores never become Execution Authority.
 * UNAVAILABLE is fail-closed: it is never rewritten to CLEAR.
 */
export const SCREENING_OUTCOMES = ['CLEAR', 'REVIEW', 'HOLD', 'BLOCK', 'UNAVAILABLE'] as const;
export type ScreeningOutcome = (typeof SCREENING_OUTCOMES)[number];

export const SCREENING_TYPES = [
  'SANCTIONS',
  'PEP',
  'ADVERSE_MEDIA',
  'TRANSACTION_MONITORING',
  'FRAUD',
  'DEVICE_RISK',
] as const;
export type ScreeningType = (typeof SCREENING_TYPES)[number];

export const SUBJECT_KINDS = [
  'PERSON',
  'BUSINESS',
  'BENEFICIARY',
  'COUNTERPARTY',
  'DEVICE',
  'ACCOUNT',
] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const AML_CATEGORIES = ['LOW', 'STANDARD', 'ELEVATED', 'HIGH', 'PROHIBITED'] as const;
export type AmlCategory = (typeof AML_CATEGORIES)[number];

export const FRAUD_OUTCOMES = ['ALLOW', 'STEP_UP', 'REVIEW', 'HOLD', 'BLOCK'] as const;
export type FraudOutcome = (typeof FRAUD_OUTCOMES)[number];

export const CASE_TYPES = [
  'SANCTIONS_REVIEW',
  'PEP_REVIEW',
  'AML_ALERT',
  'FRAUD_ALERT',
  'TRANSACTION_MONITORING_ALERT',
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_STATES = [
  'OPEN',
  'ASSIGNED',
  'IN_REVIEW',
  'ESCALATED',
  'CLEARED',
  'BLOCKED',
  'CLOSED',
] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const CASE_FINALITIES = ['NON_FINAL', 'FINAL_HARD_BLOCK', 'FINAL_CLEARED'] as const;
export type CaseFinality = (typeof CASE_FINALITIES)[number];

export const HUMAN_DECISIONS = ['CLEAR', 'CONTINUE_MONITORING', 'RESTRICT', 'BLOCK'] as const;
export type HumanDecisionKind = (typeof HUMAN_DECISIONS)[number];

export const COMPLIANCE_ACTOR_KINDS = ['HUMAN_OPERATOR', 'AGENT', 'AI'] as const;
export type ComplianceActorKind = (typeof COMPLIANCE_ACTOR_KINDS)[number];

export const OUTAGE_POSTURES = ['DEFER', 'REQUIRE_MANUAL_REVIEW', 'BLOCK'] as const;
export type OutagePosture = (typeof OUTAGE_POSTURES)[number];

export type ScreeningRequirement = {
  readonly required: boolean;
  readonly maxAgeHours: number;
  readonly onUnavailable: OutagePosture;
};

export type ScreeningRequirements = {
  readonly sanctions: ScreeningRequirement;
  readonly pep: ScreeningRequirement;
  readonly adverseMedia: ScreeningRequirement;
  readonly transactionMonitoring: ScreeningRequirement;
  readonly fraud: ScreeningRequirement;
  readonly deviceRisk: ScreeningRequirement;
};

/**
 * Engineering defaults for simulation. Not counsel-confirmed thresholds.
 * Required screenings fail closed on provider outage.
 */
export const DEFAULT_SIMULATION_SCREENING_REQUIREMENTS: ScreeningRequirements = Object.freeze({
  sanctions: Object.freeze({ required: true, maxAgeHours: 24, onUnavailable: 'BLOCK' }),
  pep: Object.freeze({ required: true, maxAgeHours: 168, onUnavailable: 'DEFER' }),
  adverseMedia: Object.freeze({ required: true, maxAgeHours: 168, onUnavailable: 'DEFER' }),
  transactionMonitoring: Object.freeze({ required: false, maxAgeHours: 24, onUnavailable: 'DEFER' }),
  fraud: Object.freeze({ required: true, maxAgeHours: 1, onUnavailable: 'BLOCK' }),
  deviceRisk: Object.freeze({ required: false, maxAgeHours: 24, onUnavailable: 'DEFER' }),
});

export function outageToDecision(posture: OutagePosture): DecisionStatus {
  return posture;
}

export function isScreeningOutcome(value: unknown): value is ScreeningOutcome {
  return typeof value === 'string' && (SCREENING_OUTCOMES as readonly string[]).includes(value);
}
