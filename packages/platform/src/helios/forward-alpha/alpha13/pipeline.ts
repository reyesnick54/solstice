import { buildPortfolioCapitalAllocation, type PortfolioAllocationPolicy } from './allocation.ts';
import { buildStrategyInteractionState } from './interaction.ts';
import { buildPortfolioForwardEvidence } from './metrics.ts';
import { evaluateAlpha13PortfolioForwardEvidenceQualification, type Alpha13QualificationPolicy } from './qualification.ts';
import type { ForwardStrategyPortfolio, PortfolioForwardEvidence } from './types.ts';
import type { Alpha13QualificationResult } from './qualification.ts';

export function runAlpha13PortfolioForwardEvidencePipeline(input: {
  readonly portfolio: ForwardStrategyPortfolio;
  readonly allocationPolicy?: PortfolioAllocationPolicy;
  readonly qualificationPolicy?: Alpha13QualificationPolicy;
}): { readonly evidence: PortfolioForwardEvidence; readonly qualification: Alpha13QualificationResult } {
  const allocation = buildPortfolioCapitalAllocation(
    input.portfolio,
    input.allocationPolicy ?? { cashReserveBps: 500 },
  );
  const interaction = buildStrategyInteractionState({ portfolio: input.portfolio, allocation });
  const evidence = buildPortfolioForwardEvidence({ portfolio: input.portfolio, allocation, interaction });
  const qualification = evaluateAlpha13PortfolioForwardEvidenceQualification(
    evidence,
    input.qualificationPolicy,
  );
  return Object.freeze({ evidence, qualification });
}
