import type { ValuationCommitteeRole } from './taxonomy.ts';
import {
  VALUATION_ADVOCACY_ROLES,
  VALUATION_ANALYST_SPECIALIST_ROLES,
  VALUATION_REVIEW_ROLES,
} from './taxonomy.ts';
import type { H20SpecialistAssignmentDecision, SpecialistCostProfile } from './types.ts';

const COST_PROFILES: Readonly<Record<ValuationCommitteeRole, SpecialistCostProfile>> = Object.freeze({
  REVENUE_FORECAST: Object.freeze({
    modelCostMicros: 75_000n,
    dataCostMicros: 35_000n,
    baselineInformationValue: 0.74,
  }),
  MARGIN: Object.freeze({
    modelCostMicros: 70_000n,
    dataCostMicros: 25_000n,
    baselineInformationValue: 0.72,
  }),
  CAPITAL_INTENSITY: Object.freeze({
    modelCostMicros: 85_000n,
    dataCostMicros: 30_000n,
    baselineInformationValue: 0.68,
  }),
  COST_OF_CAPITAL: Object.freeze({
    modelCostMicros: 65_000n,
    dataCostMicros: 20_000n,
    baselineInformationValue: 0.76,
  }),
  DCF_VALUATION: Object.freeze({
    modelCostMicros: 95_000n,
    dataCostMicros: 15_000n,
    baselineInformationValue: 0.8,
  }),
  REVERSE_DCF_CHALLENGE: Object.freeze({
    modelCostMicros: 110_000n,
    dataCostMicros: 10_000n,
    baselineInformationValue: 0.77,
  }),
  COMPARABLE_VALUATION: Object.freeze({
    modelCostMicros: 60_000n,
    dataCostMicros: 45_000n,
    baselineInformationValue: 0.66,
  }),
  SOTP: Object.freeze({
    modelCostMicros: 100_000n,
    dataCostMicros: 40_000n,
    baselineInformationValue: 0.63,
  }),
  BULL_VALUATION: Object.freeze({
    modelCostMicros: 40_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.75,
  }),
  BEAR_VALUATION: Object.freeze({
    modelCostMicros: 40_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.75,
  }),
  VALUATION_RISK: Object.freeze({
    modelCostMicros: 55_000n,
    dataCostMicros: 10_000n,
    baselineInformationValue: 0.79,
  }),
  VALUATION_SYNTHESIS: Object.freeze({
    modelCostMicros: 70_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.86,
  }),
});

function totalCostMicros(profile: SpecialistCostProfile): bigint {
  return profile.modelCostMicros + profile.dataCostMicros;
}

export function expectedInformationValue(input: {
  readonly baseline: number;
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
}): number {
  const uncertaintyBoost = input.currentUncertainty * 0.35;
  const importanceBoost = input.decisionImportance * 0.25;
  return Math.min(1, input.baseline + uncertaintyBoost + importanceBoost);
}

export function assignValuationSpecialists(input: {
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
  readonly forceAllSpecialists?: boolean;
}): readonly H20SpecialistAssignmentDecision[] {
  const importance = Math.min(1, Math.max(0, input.decisionImportance));
  const uncertainty = Math.min(1, Math.max(0, input.currentUncertainty));

  const decisions: H20SpecialistAssignmentDecision[] = [];

  for (const role of VALUATION_COMMITTEE_ROLES_FOR_ASSIGNMENT()) {
    const profile = COST_PROFILES[role];
    const eiv = expectedInformationValue({
      baseline: profile.baselineInformationValue,
      currentUncertainty: uncertainty,
      decisionImportance: importance,
    });
    const cost = totalCostMicros(profile);
    const costPenalty = Number(cost) / 1_000_000_000;
    const netValue = eiv - costPenalty;

    let assigned = input.forceAllSpecialists === true;
    let reason = 'skipped — expected information value does not justify model and data cost';

    if (VALUATION_ALWAYS_RUN.has(role)) {
      assigned = true;
      reason = 'mandatory committee role';
    } else if (
      !assigned &&
      EXPENSIVE_SPECIALISTS.has(role) &&
      (uncertainty >= 0.4 || importance >= 0.65) &&
      netValue > 0.2
    ) {
      assigned = true;
      reason = 'H20: expensive specialist justified by uncertainty or decisionImportance';
    } else if (!assigned && !EXPENSIVE_SPECIALISTS.has(role) && netValue > 0.08) {
      assigned = true;
      reason = 'H20: expectedInformationValue exceeds combined model and data cost';
    } else if (!assigned && importance >= 0.85 && profile.baselineInformationValue >= 0.65) {
      assigned = true;
      reason = 'H20: high decisionImportance warrants specialist';
    }

    decisions.push(
      Object.freeze({
        role,
        assigned,
        expectedInformationValue: eiv,
        modelCostMicros: profile.modelCostMicros,
        dataCostMicros: profile.dataCostMicros,
        currentUncertainty: uncertainty,
        decisionImportance: importance,
        reason,
      }),
    );
  }

  return Object.freeze(decisions);
}

const VALUATION_ALWAYS_RUN = new Set<ValuationCommitteeRole>([
  'REVENUE_FORECAST',
  'DCF_VALUATION',
  'REVERSE_DCF_CHALLENGE',
  'VALUATION_SYNTHESIS',
  'BULL_VALUATION',
  'BEAR_VALUATION',
  'VALUATION_RISK',
]);

const EXPENSIVE_SPECIALISTS = new Set<ValuationCommitteeRole>([
  'REVERSE_DCF_CHALLENGE',
  'SOTP',
  'COMPARABLE_VALUATION',
]);

function VALUATION_COMMITTEE_ROLES_FOR_ASSIGNMENT(): readonly ValuationCommitteeRole[] {
  return Object.freeze([
    ...VALUATION_ANALYST_SPECIALIST_ROLES,
    ...VALUATION_ADVOCACY_ROLES,
    ...VALUATION_REVIEW_ROLES,
    'VALUATION_SYNTHESIS',
  ] as const);
}

export function assignedRoles(
  decisions: readonly H20SpecialistAssignmentDecision[],
): readonly ValuationCommitteeRole[] {
  return Object.freeze(decisions.filter((row) => row.assigned).map((row) => row.role));
}
