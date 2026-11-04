/** Gate marker for EARN06 earnings quality plane qualification checks. */
export const HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED = 'HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED' as const;
export const HELIOS_EARN06_EARNINGS_QUALITY_BLOCKED = 'HELIOS_EARN06_EARNINGS_QUALITY_BLOCKED' as const;

export type Earn06QualificationChecks = {
  readonly pointInTimeQuartersFiltered: boolean;
  readonly separateScorecardDimensions: boolean;
  readonly noOpaqueCompositeScore: boolean;
  readonly forensicHypothesisLanguageOnly: boolean;
  readonly multiHorizonForensicCompare: boolean;
  readonly guidanceCompareWhenKnowable: boolean;
  readonly missingInputsDegradedNotInvented: boolean;
  readonly noExecutionAuthority: boolean;
  readonly forensicAgentChallengesBothCases: boolean;
};

export type Earn06QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED
    | typeof HELIOS_EARN06_EARNINGS_QUALITY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof Earn06QualificationChecks, string> = {
  pointInTimeQuartersFiltered: 'point_in_time_quarters',
  separateScorecardDimensions: 'separate_scorecard_dimensions',
  noOpaqueCompositeScore: 'no_opaque_composite_score',
  forensicHypothesisLanguageOnly: 'forensic_hypothesis_language',
  multiHorizonForensicCompare: 'multi_horizon_forensic_compare',
  guidanceCompareWhenKnowable: 'guidance_compare_when_knowable',
  missingInputsDegradedNotInvented: 'missing_inputs_degraded',
  noExecutionAuthority: 'no_execution_authority',
  forensicAgentChallengesBothCases: 'forensic_agent_challenges_both_cases',
};

export function evaluateEarn06Qualification(checks: Earn06QualificationChecks): Earn06QualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Earn06QualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(CHECK_LABELS[key]);
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EARN06_EARNINGS_QUALITY_QUALIFIED : HELIOS_EARN06_EARNINGS_QUALITY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
