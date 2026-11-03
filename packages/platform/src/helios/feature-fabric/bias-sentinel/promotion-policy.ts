import type {
  BiasAssessment,
  BiasPromotionDecision,
  BiasPromotionGateResult,
  BiasPromotionPolicy,
  BiasSeverity,
} from './types.ts';

export const DEFAULT_BIAS_SENTINEL_PROMOTION_POLICY: BiasPromotionPolicy = Object.freeze({
  policyId: 'aafv2_5-bias-sentinel-promotion-v1',
  severeDecision: 'BLOCK_PROMOTION',
  warningDecision: 'REVIEW_REQUIRED',
  insufficientDataDecision: 'REVIEW_REQUIRED',
});

function decisionForSeverity(
  severity: BiasSeverity,
  policy: BiasPromotionPolicy,
): BiasPromotionDecision {
  switch (severity) {
    case 'SEVERE':
      return policy.severeDecision;
    case 'WARNING':
      return policy.warningDecision;
    case 'INSUFFICIENT_DATA':
      return policy.insufficientDataDecision;
    case 'PASS':
      return 'CONTINUE';
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

export function evaluateBiasPromotionGate(input: {
  readonly assessment: BiasAssessment;
  readonly policy?: BiasPromotionPolicy;
}): BiasPromotionGateResult {
  const policy = input.policy ?? DEFAULT_BIAS_SENTINEL_PROMOTION_POLICY;
  const severity = input.assessment.severity;
  const decision = decisionForSeverity(severity, policy);
  const blockers: string[] = [];

  if (decision === 'BLOCK_PROMOTION') {
    blockers.push(`bias_sentinel_${severity.toLowerCase()}_blocks_promotion`);
  }
  if (decision === 'REVIEW_REQUIRED') {
    blockers.push(`bias_sentinel_${severity.toLowerCase()}_requires_review`);
  }

  for (const finding of input.assessment.findings) {
    if (finding.severity === 'SEVERE' && policy.severeDecision === 'BLOCK_PROMOTION') {
      blockers.push(`bias_finding_severe:${finding.dimension}`);
    }
  }

  const uniqueBlockers = [...new Set(blockers)];
  return Object.freeze({
    decision,
    permitted: decision === 'CONTINUE',
    blockers: Object.freeze(uniqueBlockers),
    assessmentSeverity: severity,
  });
}
