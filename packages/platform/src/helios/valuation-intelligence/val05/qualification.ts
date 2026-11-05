import {
  HELIOS_VAL05_REVERSE_DCF_BLOCKED,
  HELIOS_VAL05_REVERSE_DCF_QUALIFIED,
} from '../taxonomy.ts';

export { HELIOS_VAL05_REVERSE_DCF_QUALIFIED, HELIOS_VAL05_REVERSE_DCF_BLOCKED };

export type Val05QualificationChecks = {
  readonly combinationSurfaceNonEmpty: boolean;
  readonly nonUniqueAnswerAcknowledged: boolean;
  readonly expectationGapComputed: boolean;
  readonly priceLevelScenariosPresent: boolean;
  readonly noInvestmentRecommendation: boolean;
  readonly researchEvidenceOnly: boolean;
  readonly noExecutionAuthority: boolean;
  readonly capitalStructurePresent: boolean;
  readonly discountDistributionPresent: boolean;
  readonly operatingEconomicsPresent: boolean;
};

export type Val05QualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL05_REVERSE_DCF_QUALIFIED
    | typeof HELIOS_VAL05_REVERSE_DCF_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal05ReverseDcfQualification(
  checks: Val05QualificationChecks,
): Val05QualificationResult {
  const blockers: string[] = [];
  const entries: [keyof Val05QualificationChecks, string][] = [
    ['combinationSurfaceNonEmpty', 'combination_surface'],
    ['nonUniqueAnswerAcknowledged', 'non_unique_acknowledged'],
    ['expectationGapComputed', 'expectation_gap'],
    ['priceLevelScenariosPresent', 'price_level_scenarios'],
    ['noInvestmentRecommendation', 'no_investment_recommendation'],
    ['researchEvidenceOnly', 'research_evidence_only'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['capitalStructurePresent', 'capital_structure'],
    ['discountDistributionPresent', 'discount_distribution'],
    ['operatingEconomicsPresent', 'operating_economics'],
  ];
  for (const [key, label] of entries) {
    if (!checks[key]) {
      blockers.push(label);
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL05_REVERSE_DCF_QUALIFIED : HELIOS_VAL05_REVERSE_DCF_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
