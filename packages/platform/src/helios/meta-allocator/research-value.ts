import type { ResearchBudgetSnapshot } from '../execution-types.ts';
import { computeRemainingBudget } from '../budget.ts';
import type { ResearchValueAssessment, ResearchValueInput, PublicResearchReuseRecord } from './types.ts';
import type { MetaAllocatorReasonCode } from './taxonomy.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

export function evaluateResearchValue(
  input: ResearchValueInput,
  budget: ResearchBudgetSnapshot,
  reuse: PublicResearchReuseRecord | null | undefined,
): ResearchValueAssessment {
  const reasonCodes: MetaAllocatorReasonCode[] = [];
  const remaining = parseMinor(computeRemainingBudget(budget));
  const estimatedCost = parseMinor(input.estimatedResearchCostMinor);
  let marginalCost = estimatedCost;

  if (reuse && reuse.rights === 'PUBLIC') {
    marginalCost = parseMinor(reuse.marginalCostMinor);
    reasonCodes.push('PUBLIC_RESEARCH_REUSED');
  }

  const budgetLow = remaining < estimatedCost * 2n;
  if (budgetLow) {
    reasonCodes.push('BUDGET_LOW');
  }
  if (remaining <= 0n) {
    reasonCodes.push('BUDGET_EXHAUSTED');
  }

  if (input.confidenceState === 'UNKNOWN') {
    reasonCodes.push('UNKNOWN_CONFIDENCE');
  } else if (input.confidenceState === 'LOW_CONFIDENCE') {
    reasonCodes.push('LOW_CONFIDENCE');
  }

  if (!input.dataAvailable) {
    reasonCodes.push('WAIT_FOR_DATA');
  }

  const highUncertainty = input.unresolvedUncertainty === 'HIGH';
  const lowEvidence =
    input.evidenceQuality === 'INSUFFICIENT' || input.evidenceQuality === 'LOW';
  const cheapResearch = marginalCost <= estimatedCost / 2n || marginalCost <= remaining / 4n;
  const largeOpportunity =
    parseMinor(input.estimatedOpportunitySizeMinor) >= parseMinor('100000');
  const timePressure = input.timeRemainingHours < input.opportunityHalfLifeHours;

  let informationValueTier: ResearchValueAssessment['informationValueTier'] = 'UNKNOWN';
  if (highUncertainty && lowEvidence && cheapResearch && largeOpportunity && input.dataAvailable) {
    informationValueTier = 'HIGH';
    reasonCodes.push('HIGH_INFORMATION_VALUE');
  } else if (input.evidenceQuality === 'HIGH' && !input.specialistDisagreement) {
    informationValueTier = 'LOW';
    reasonCodes.push('LOW_INFORMATION_VALUE');
  } else if (input.evidenceQuality === 'MEDIUM') {
    informationValueTier = 'MEDIUM';
  } else if (lowEvidence && highUncertainty) {
    informationValueTier = 'HIGH';
    reasonCodes.push('HIGH_INFORMATION_VALUE');
  }

  const researchTooExpensive =
    marginalCost > remaining ||
    (budgetLow && marginalCost > remaining / 2n) ||
    (parseMinor(input.estimatedOpportunitySizeMinor) < marginalCost * 3n && !input.accountSizeFeasible);
  if (researchTooExpensive) {
    reasonCodes.push('RESEARCH_TOO_EXPENSIVE');
  }

  const economicallyJustified =
    remaining > 0n &&
    marginalCost <= remaining &&
    !researchTooExpensive &&
    input.dataAvailable &&
    (informationValueTier === 'HIGH' || informationValueTier === 'MEDIUM') &&
    (timePressure || highUncertainty || lowEvidence);

  if (lowEvidence && input.evidenceQuality === 'INSUFFICIENT') {
    reasonCodes.push('INSUFFICIENT_EVIDENCE');
  }

  return Object.freeze({
    informationValueTier,
    economicallyJustified,
    confidenceState: input.confidenceState,
    reasonCodes: Object.freeze(reasonCodes),
    marginalResearchCostMinor: marginalCost.toString(),
    publicReuseApplied: Boolean(reuse && reuse.rights === 'PUBLIC'),
  });
}

export function researchSpendFromAssessment(
  assessment: ResearchValueAssessment,
  input: ResearchValueInput,
  budget: ResearchBudgetSnapshot,
): { readonly decision: import('./taxonomy.ts').ResearchSpendDecision; readonly maxSpendMinor: string } {
  const remaining = parseMinor(computeRemainingBudget(budget));
  const marginal = parseMinor(assessment.marginalResearchCostMinor);

  if (!input.dataAvailable) {
    return { decision: 'WAIT_FOR_DATA', maxSpendMinor: '0' };
  }
  if (remaining <= 0n || !assessment.economicallyJustified) {
    if (assessment.reasonCodes.includes('RESEARCH_TOO_EXPENSIVE')) {
      return { decision: 'DO_NOT_RESEARCH', maxSpendMinor: '0' };
    }
    return { decision: 'DO_NOT_RESEARCH', maxSpendMinor: '0' };
  }
  if (assessment.reasonCodes.includes('BUDGET_LOW') || remaining < marginal * 2n) {
    return {
      decision: 'RESEARCH_MINIMAL',
      maxSpendMinor: (remaining / 4n > 0n ? remaining / 4n : remaining).toString(),
    };
  }
  if (assessment.informationValueTier === 'HIGH' && marginal <= remaining) {
    if (marginal * 2n <= remaining) {
      return { decision: 'RESEARCH_STANDARD', maxSpendMinor: marginal.toString() };
    }
    return { decision: 'RESEARCH_DEEPER', maxSpendMinor: (marginal * 2n <= remaining ? marginal * 2n : remaining).toString() };
  }
  if (assessment.informationValueTier === 'MEDIUM') {
    return { decision: 'RESEARCH_MINIMAL', maxSpendMinor: (marginal <= remaining ? marginal : remaining).toString() };
  }
  return { decision: 'DO_NOT_RESEARCH', maxSpendMinor: '0' };
}
