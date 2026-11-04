import type { EarningsCommitteeRole } from './taxonomy.ts';
import {
  EARNINGS_ADVOCACY_ROLES,
  EARNINGS_ANALYST_SPECIALIST_ROLES,
  EARNINGS_REVIEW_ROLES,
} from './taxonomy.ts';
import type { H20SpecialistAssignmentDecision, SpecialistCostProfile } from './types.ts';

const COST_PROFILES: Readonly<Record<EarningsCommitteeRole, SpecialistCostProfile>> = Object.freeze({
  HARD_FINANCIALS: Object.freeze({
    modelCostMicros: 80_000n,
    dataCostMicros: 20_000n,
    baselineInformationValue: 0.72,
  }),
  ANALYST_EXPECTATIONS: Object.freeze({
    modelCostMicros: 60_000n,
    dataCostMicros: 40_000n,
    baselineInformationValue: 0.68,
  }),
  TRANSCRIPT_INTELLIGENCE: Object.freeze({
    modelCostMicros: 120_000n,
    dataCostMicros: 50_000n,
    baselineInformationValue: 0.55,
  }),
  EARNINGS_QUALITY: Object.freeze({
    modelCostMicros: 90_000n,
    dataCostMicros: 30_000n,
    baselineInformationValue: 0.7,
  }),
  OPTIONS_EARNINGS: Object.freeze({
    modelCostMicros: 100_000n,
    dataCostMicros: 60_000n,
    baselineInformationValue: 0.5,
  }),
  PEER_READ_THROUGH: Object.freeze({
    modelCostMicros: 70_000n,
    dataCostMicros: 35_000n,
    baselineInformationValue: 0.62,
  }),
  MACRO_CONTEXT: Object.freeze({
    modelCostMicros: 50_000n,
    dataCostMicros: 25_000n,
    baselineInformationValue: 0.58,
  }),
  BULL_EARNINGS: Object.freeze({
    modelCostMicros: 40_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.75,
  }),
  BEAR_EARNINGS: Object.freeze({
    modelCostMicros: 40_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.75,
  }),
  FORENSIC_ACCOUNTING: Object.freeze({
    modelCostMicros: 110_000n,
    dataCostMicros: 40_000n,
    baselineInformationValue: 0.78,
  }),
  RISK_EARNINGS: Object.freeze({
    modelCostMicros: 55_000n,
    dataCostMicros: 10_000n,
    baselineInformationValue: 0.8,
  }),
  EARNINGS_SYNTHESIS: Object.freeze({
    modelCostMicros: 65_000n,
    dataCostMicros: 0n,
    baselineInformationValue: 0.85,
  }),
});

function totalCostMicros(profile: SpecialistCostProfile): bigint {
  return profile.modelCostMicros + profile.dataCostMicros;
}

/** H20-style value-of-information gate: do not run every expensive specialist by default. */
export function expectedInformationValue(input: {
  readonly baseline: number;
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
}): number {
  const uncertaintyBoost = input.currentUncertainty * 0.35;
  const importanceBoost = input.decisionImportance * 0.25;
  return Math.min(1, input.baseline + uncertaintyBoost + importanceBoost);
}

export function assignEarningsSpecialists(input: {
  readonly currentUncertainty: number;
  readonly decisionImportance: number;
  readonly forceAllSpecialists?: boolean;
}): readonly H20SpecialistAssignmentDecision[] {
  const importance = Math.min(1, Math.max(0, input.decisionImportance));
  const uncertainty = Math.min(1, Math.max(0, input.currentUncertainty));

  const decisions: H20SpecialistAssignmentDecision[] = [];

  for (const role of EARNINGS_COMMITTEE_ROLES_FOR_ASSIGNMENT()) {
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

    if (EARNINGS_ALWAYS_RUN.has(role)) {
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

const EARNINGS_ALWAYS_RUN = new Set<EarningsCommitteeRole>([
  'HARD_FINANCIALS',
  'EARNINGS_SYNTHESIS',
  'BULL_EARNINGS',
  'BEAR_EARNINGS',
  'FORENSIC_ACCOUNTING',
  'RISK_EARNINGS',
]);

/** High model/data cost — require material uncertainty or decision weight before assignment. */
const EXPENSIVE_SPECIALISTS = new Set<EarningsCommitteeRole>([
  'TRANSCRIPT_INTELLIGENCE',
  'OPTIONS_EARNINGS',
  'FORENSIC_ACCOUNTING',
]);

function EARNINGS_COMMITTEE_ROLES_FOR_ASSIGNMENT(): readonly EarningsCommitteeRole[] {
  return Object.freeze([
    ...EARNINGS_ANALYST_SPECIALIST_ROLES,
    ...EARNINGS_ADVOCACY_ROLES,
    ...EARNINGS_REVIEW_ROLES,
    'EARNINGS_SYNTHESIS',
  ] as const);
}

export function assignedRoles(
  decisions: readonly H20SpecialistAssignmentDecision[],
): readonly EarningsCommitteeRole[] {
  return Object.freeze(decisions.filter((row) => row.assigned).map((row) => row.role));
}
