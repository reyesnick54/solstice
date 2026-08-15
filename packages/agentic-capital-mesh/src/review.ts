import { createHash } from 'node:crypto';

import { asCapitalReviewId } from './ids.ts';
import type {
  AdversarialReview,
  CapitalAllocationCandidate,
  CapitalContext,
  Disagreement,
  NodeOutput,
} from './types.ts';

export function reviewCandidate(input: {
  readonly candidate: CapitalAllocationCandidate;
  readonly context: CapitalContext;
  readonly concentrationNote: string;
  readonly riskNote: string;
  readonly staleNote: string;
}): AdversarialReview {
  const material = `${input.candidate.candidateId}:${input.context.contextId}`;
  return Object.freeze({
    reviewId: asCapitalReviewId(`cmrev_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
    candidateId: input.candidate.candidateId,
    weakestAssumption: 'Historical ETF relationships continue; this is not a forecast of return.',
    contradictoryData: Object.freeze([
      'Existing single-name concentration may already be material.',
      'Strategy Lab has not validated the candidate.',
    ]),
    downsideScenario: 'Correlated equity shock reduces the proposed sleeve without a guaranteed recovery.',
    concentration: input.concentrationNote,
    liquidity: `Protected liquidity ${input.context.mandate.minimumLiquidMinor.toString()} and unsettled ${input.context.portfolio.unsettledCashMinor.toString()} are not investable.`,
    mandateFit: input.context.mandate.compatibleWithInvestment
      ? 'Mandate permits considering investment activity; it does not authorize a trade.'
      : 'Mandate does not treat investment activity as currently in-scope.',
    riskLimits: input.riskNote,
    staleMarketData: input.staleNote,
    regulatoryReadiness: `${input.context.rdt.state}/${input.context.rdt.legalReviewStatus}; not regulatory approved.`,
    modelLimitations: Object.freeze([
      'Specialist nodes produce structured critique, not execution authority.',
      'Material models must already be APPROVED_FOR_SIMULATION in the Model Registry.',
    ]),
  });
}

export function collectDisagreements(outputs: readonly NodeOutput[]): readonly Disagreement[] {
  return Object.freeze(
    outputs.map((output) =>
      Object.freeze({
        role: output.role,
        stance: output.stance,
        summary: output.summary,
      }),
    ),
  );
}
