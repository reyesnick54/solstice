import type { CustomerId } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { ExecutableOpportunityQualificationService } from '../executable-opportunity/qualification-service.ts';
import type { GrokResearchResult } from './types.ts';

export type CandidateRoutingOutcome = {
  readonly routed: boolean;
  readonly candidateId: string | null;
  readonly reason: string;
  readonly grantsExecutionAuthority: false;
};

/**
 * Routes Grok research candidate proposals through H09 executable-opportunity
 * pipeline. Hypothesis is not trade; no execution authority is granted.
 */
export function routeResearchCandidatesToH09(input: {
  readonly result: GrokResearchResult;
  readonly qualificationService: ExecutableOpportunityQualificationService;
  readonly customerId: CustomerId;
  readonly subjectId: string;
}): readonly CandidateRoutingOutcome[] {
  if (input.result.recommendation !== 'PROPOSE_CANDIDATE') {
    return Object.freeze([Object.freeze({
      routed: false,
      candidateId: null,
      reason: `recommendation ${input.result.recommendation} does not propose candidates`,
      grantsExecutionAuthority: false,
    })]);
  }

  const outcomes: CandidateRoutingOutcome[] = [];
  for (const candidateRef of input.result.candidateRefs) {
    const candidate = input.qualificationService.discoverCandidate({
      workOrderId: input.result.workOrderId as EconomicWorkOrderId,
      customerId: input.customerId,
      subjectId: input.subjectId,
      source: 'AGENT_RESEARCH',
      hypothesisType: candidateRef.candidateKey,
      evidenceRefs: Object.freeze([...candidateRef.evidenceRefs]),
      instrumentCandidate: Object.freeze({
        instrumentId: `inst_${candidateRef.candidateKey}`,
        productId: 'prod_fx_sim',
        symbol: candidateRef.instrumentSymbol ?? 'USD',
        assetClass: 'FX',
      }),
      key: candidateRef.candidateKey,
    });
    outcomes.push(Object.freeze({
      routed: true,
      candidateId: candidate.candidateId,
      reason: 'candidate discovered via H09 AGENT_RESEARCH source',
      grantsExecutionAuthority: false,
    }));
  }

  if (outcomes.length === 0) {
    outcomes.push(Object.freeze({
      routed: false,
      candidateId: null,
      reason: 'PROPOSE_CANDIDATE without candidate refs',
      grantsExecutionAuthority: false,
    }));
  }

  return Object.freeze(outcomes);
}
