import type { BearCase, BullCase, ResearchSynthesis, RiskCase } from './types.ts';
import type { CounterEvidenceChallenge } from './types.ts';

/**
 * Summarizes agreement and disagreement without averaging stances or picking a winner.
 */
export function synthesizeResearchDebate(input: {
  readonly bullCase: BullCase;
  readonly bearCase: BearCase;
  readonly riskCase: RiskCase;
  readonly rebuttals: readonly CounterEvidenceChallenge[];
}): ResearchSynthesis {
  const agreement: string[] = [];
  const disagreement: string[] = [];

  const bullEvidence = new Set(input.bullCase.supportingEvidenceIds);
  const bearEvidence = new Set(input.bearCase.supportingEvidenceIds);
  for (const id of bullEvidence) {
    if (bearEvidence.has(id)) {
      agreement.push(`Both sides reference evidence ${id} but interpret implications differently.`);
    }
  }
  if (agreement.length === 0) {
    agreement.push('Both sides accept the frozen evidence pack as the shared factual substrate.');
  }

  disagreement.push(
    `Bull thesis (${input.bullCase.claims.length} claims) conflicts with bear thesis (${input.bearCase.claims.length} claims).`,
  );
  disagreement.push(`Risk evaluator highlights: ${input.riskCase.dominantRiskFactors.join(', ')}.`);
  for (const rebuttal of input.rebuttals) {
    disagreement.push(
      `${rebuttal.fromParticipant} rebuttal on ${rebuttal.targetClaimId}: ${rebuttal.counterStatement}`,
    );
  }

  return Object.freeze({
    participant: 'SYNTHESIS',
    summary:
      'Structured synthesis preserves bull/bear/risk disagreement; no opinion averaging or forced winner.',
    pointsOfAgreement: Object.freeze(agreement),
    pointsOfDisagreement: Object.freeze(disagreement),
    preservedDisagreement: true as const,
    consensusIsNotTruth: true as const,
  });
}
