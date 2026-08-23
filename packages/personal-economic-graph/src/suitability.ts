import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  ConcentrationLevel,
  InvestmentExperienceLevel,
  LiquidityNeedLevel,
  LossSensitivityLevel,
  ProductEligibilityState,
  RiskCapacityLevel,
  RiskToleranceLevel,
  TimeHorizonBand,
} from './taxonomy.ts';

/**
 * Deterministic risk / suitability assessment.
 * An LLM must not fabricate these scores. AI may only explain them.
 */
export const SUITABILITY_QUESTIONNAIRE_VERSION = 'sunrey.grow.suitability.v1' as const;

export type SuitabilityAnswers = {
  readonly riskTolerance: RiskToleranceLevel;
  readonly liquidReserveMonths: number;
  readonly knownNearTermNeed: boolean;
  readonly investmentHorizonYears: number;
  readonly expectedWithdrawalYears: number;
  readonly investmentExperience: InvestmentExperienceLevel;
  readonly lossSensitivity: LossSensitivityLevel;
  readonly largestPositionShareBps?: number;
  readonly jurisdiction: string;
};

export type SuitabilityProfile = {
  readonly questionnaireVersion: typeof SUITABILITY_QUESTIONNAIRE_VERSION;
  readonly assessedAt: UtcInstant;
  readonly riskTolerance: RiskToleranceLevel;
  readonly riskCapacity: RiskCapacityLevel;
  readonly timeHorizon: TimeHorizonBand;
  readonly liquidityNeed: LiquidityNeedLevel;
  readonly investmentExperience: InvestmentExperienceLevel;
  readonly lossSensitivity: LossSensitivityLevel;
  readonly concentration: ConcentrationLevel;
  readonly jurisdictionalEligibility: ProductEligibilityState;
  readonly method: 'DETERMINISTIC_QUESTIONNAIRE';
  readonly llmFabricated: false;
};

const TOLERANCE_RANK: Record<RiskToleranceLevel, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

function capacityOf(answers: SuitabilityAnswers): RiskCapacityLevel {
  if (answers.knownNearTermNeed || answers.liquidReserveMonths < 2) {
    return 'CONSTRAINED';
  }
  if (answers.liquidReserveMonths < 4) {
    return 'LIMITED';
  }
  if (answers.liquidReserveMonths < 8) {
    return 'ADEQUATE';
  }
  return 'STRONG';
}

function horizonOf(answers: SuitabilityAnswers): TimeHorizonBand {
  const years = Math.min(answers.investmentHorizonYears, answers.expectedWithdrawalYears);
  if (years < 3) {
    return 'NEAR_TERM';
  }
  if (years < 8) {
    return 'MEDIUM';
  }
  return 'LONG';
}

function liquidityOf(answers: SuitabilityAnswers): LiquidityNeedLevel {
  if (answers.knownNearTermNeed) {
    return 'IMMEDIATE';
  }
  if (answers.liquidReserveMonths < 3) {
    return 'ELEVATED';
  }
  if (answers.liquidReserveMonths < 6) {
    return 'MODERATE';
  }
  return 'LOW';
}

function concentrationOf(shareBps: number | undefined): ConcentrationLevel {
  if (shareBps === undefined) {
    return 'MODERATE';
  }
  if (shareBps >= 6000) {
    return 'HIGHLY_CONCENTRATED';
  }
  if (shareBps >= 4000) {
    return 'CONCENTRATED';
  }
  if (shareBps >= 2500) {
    return 'MODERATE';
  }
  return 'DIVERSIFIED';
}

function eligibilityOf(jurisdiction: string): ProductEligibilityState {
  const known = new Set(['US', 'GB', 'SA', 'AE', 'EU']);
  return known.has(jurisdiction) ? 'ELIGIBLE_SIMULATION' : 'UNKNOWN_RESEARCH_REQUIRED';
}

/**
 * Capacity and horizon may only tighten displayed tolerance. They never loosen it.
 */
export function assessSuitability(answers: SuitabilityAnswers, at: UtcInstant): SuitabilityProfile {
  const riskCapacity = capacityOf(answers);
  const timeHorizon = horizonOf(answers);
  let displayedTolerance = answers.riskTolerance;
  if (riskCapacity === 'CONSTRAINED' && TOLERANCE_RANK[displayedTolerance] > 1) {
    displayedTolerance = 'LOW';
  }
  if (timeHorizon === 'NEAR_TERM' && TOLERANCE_RANK[displayedTolerance] > 2) {
    displayedTolerance = 'MODERATE';
  }
  return Object.freeze({
    questionnaireVersion: SUITABILITY_QUESTIONNAIRE_VERSION,
    assessedAt: at,
    riskTolerance: displayedTolerance,
    riskCapacity,
    timeHorizon,
    liquidityNeed: liquidityOf(answers),
    investmentExperience: answers.investmentExperience,
    lossSensitivity: answers.lossSensitivity,
    concentration: concentrationOf(answers.largestPositionShareBps),
    jurisdictionalEligibility: eligibilityOf(answers.jurisdiction),
    method: 'DETERMINISTIC_QUESTIONNAIRE',
    llmFabricated: false,
  });
}
