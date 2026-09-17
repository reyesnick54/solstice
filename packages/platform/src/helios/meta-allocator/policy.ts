import type { WorkOrderDisposition } from '../../work-order/taxonomy.ts';
import type {
  CapitalAllocationRecommendation,
  FeasibilityAssessment,
  ResearchSpendRecommendation,
  ResearchValueAssessment,
} from './types.ts';
import type {
  CapitalRecommendationDecision,
  MetaAllocatorReasonCode,
  ResearchSpendDecision,
  StrategyQualificationState,
} from './taxonomy.ts';
import { META_ALLOCATOR_POLICY_VERSION } from './taxonomy.ts';

export { META_ALLOCATOR_POLICY_VERSION };

export function evaluateCapitalRecommendation(
  strategyState: StrategyQualificationState,
  feasibility: FeasibilityAssessment,
  evidenceSufficient: boolean,
  portfolioAllowed: boolean,
): {
  readonly recommendation: CapitalRecommendationDecision;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
} {
  const reasonCodes: MetaAllocatorReasonCode[] = [...feasibility.reasonCodes];

  if (strategyState === 'UNQUALIFIED' || strategyState === 'REJECTED') {
    reasonCodes.push('STRATEGY_UNQUALIFIED');
    return { recommendation: 'NO_ACTION', reasonCodes: Object.freeze(reasonCodes) };
  }
  if (strategyState === 'NEEDS_VALIDATION') {
    reasonCodes.push('STRATEGY_UNQUALIFIED');
    return { recommendation: 'WAIT', reasonCodes: Object.freeze(reasonCodes) };
  }
  if (!evidenceSufficient) {
    reasonCodes.push('INSUFFICIENT_EVIDENCE');
    return { recommendation: 'NO_ACTION', reasonCodes: Object.freeze(reasonCodes) };
  }
  if (feasibility.reasonCodes.includes('COSTS_CONSUME_EDGE')) {
    reasonCodes.push('COSTS_CONSUME_EDGE');
    return { recommendation: 'NO_ACTION', reasonCodes: Object.freeze(reasonCodes) };
  }
  if (feasibility.reasonCodes.includes('INSUFFICIENT_LIQUIDITY')) {
    reasonCodes.push('INSUFFICIENT_LIQUIDITY');
    return { recommendation: 'WAIT', reasonCodes: Object.freeze(reasonCodes) };
  }
  if (!feasibility.feasible || !portfolioAllowed) {
    return { recommendation: 'NO_ACTION', reasonCodes: Object.freeze(reasonCodes) };
  }

  reasonCodes.push('STRONG_EVIDENCE', 'FEASIBLE_DEPLOYMENT');
  return { recommendation: 'PROPOSE', reasonCodes: Object.freeze(reasonCodes) };
}

export function evaluateMetaDisposition(input: {
  readonly researchSpend: ResearchSpendDecision;
  readonly researchAssessment: ResearchValueAssessment;
  readonly capitalRecommendation: CapitalRecommendationDecision;
  readonly strategyState: StrategyQualificationState;
  readonly feasibility: FeasibilityAssessment;
}): WorkOrderDisposition {
  if (input.capitalRecommendation === 'PROPOSE' && input.strategyState === 'QUALIFIED' && input.feasibility.feasible) {
    return 'PROPOSE';
  }

  if (
    (input.researchSpend === 'RESEARCH_STANDARD' ||
      input.researchSpend === 'RESEARCH_DEEPER' ||
      input.researchSpend === 'RESEARCH_MINIMAL') &&
    input.researchAssessment.economicallyJustified &&
    (input.researchAssessment.informationValueTier === 'HIGH' ||
      input.researchAssessment.informationValueTier === 'MEDIUM') &&
    input.capitalRecommendation !== 'PROPOSE'
  ) {
    return 'INVESTIGATE';
  }

  if (input.researchSpend === 'WAIT_FOR_DATA' || input.capitalRecommendation === 'WAIT') {
    return 'WAIT';
  }

  if (
    input.researchAssessment.reasonCodes.includes('RESEARCH_TOO_EXPENSIVE') &&
    !input.feasibility.feasible
  ) {
    return 'ABANDON';
  }

  if (
    input.strategyState === 'REJECTED' ||
    (input.researchSpend === 'DO_NOT_RESEARCH' && input.capitalRecommendation === 'ABANDON')
  ) {
    return 'ABANDON';
  }

  return 'NO_ACTION';
}

export function evidenceSufficientForProposal(
  quality: import('./taxonomy.ts').EvidenceQualityLevel,
  confidence: import('./taxonomy.ts').ConfidenceState,
): boolean {
  if (quality === 'INSUFFICIENT' || quality === 'LOW') {
    return false;
  }
  if (confidence === 'UNKNOWN') {
    return false;
  }
  return quality === 'HIGH' || quality === 'MEDIUM';
}

export function combineReasonCodes(
  ...groups: readonly (readonly MetaAllocatorReasonCode[])[]
): readonly MetaAllocatorReasonCode[] {
  const seen = new Set<MetaAllocatorReasonCode>();
  const out: MetaAllocatorReasonCode[] = [];
  for (const group of groups) {
    for (const code of group) {
      if (!seen.has(code)) {
        seen.add(code);
        out.push(code);
      }
    }
  }
  return Object.freeze(out);
}

export function policyBoundaryCheck(
  recommendation: CapitalAllocationRecommendation | null,
): boolean {
  if (!recommendation) {
    return true;
  }
  return recommendation.grantsFinancialEffect === false && recommendation.postsReservation === false;
}
