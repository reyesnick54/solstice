import { asUtcInstant } from '@solstice/domain';
import { buildCrossMarketEvidenceGraph } from './build.ts';
import {
  detectCrossAssetConfirmations,
  detectCrossAssetContradictions,
  detectCrossMarketDislocations,
  evaluateCrossMarketProbabilityStates,
} from './evaluate.ts';
import { crossMarketDislocationToOpportunityCandidate } from './opportunity-bridge.ts';
import { buildCrossMarketResearchTriggerProposal } from './research-trigger-bridge.ts';
import type { CrossMarketIntelligenceEvaluateInput, CrossMarketIntelligenceResult } from './types.ts';

const OPPORTUNITY_TTL_MS = 72 * 60 * 60 * 1000;

function instrumentIdsFromObservations(
  observations: CrossMarketIntelligenceEvaluateInput['observations'],
): readonly string[] {
  const ids = observations
    .filter((o) => o.domain !== 'MACRO' && o.domain !== 'NEWS' && o.domain !== 'SENTIMENT')
    .map((o) => o.entityId);
  return Object.freeze([...new Set(ids)]);
}

export function runCrossMarketIntelligence(
  input: CrossMarketIntelligenceEvaluateInput,
): CrossMarketIntelligenceResult {
  const graph = buildCrossMarketEvidenceGraph({
    graphId: input.graphId,
    observations: input.observations,
    now: input.now,
  });

  const probabilityStates = evaluateCrossMarketProbabilityStates({
    observations: input.observations,
    now: input.now,
  });

  const confirmations = detectCrossAssetConfirmations({ graph, observations: input.observations });
  const contradictions = detectCrossAssetContradictions({ observations: input.observations });
  const dislocations = detectCrossMarketDislocations({
    graph,
    observations: input.observations,
    probabilityStates,
    now: input.now,
  });

  const expiresAt = asUtcInstant(new Date(Date.parse(input.now) + OPPORTUNITY_TTL_MS).toISOString());
  const instrumentIds = instrumentIdsFromObservations(input.observations);

  const opportunityCandidates = dislocations
    .filter((d) => d.researchTriggerKind !== null)
    .map((dislocation) =>
      crossMarketDislocationToOpportunityCandidate({
        dislocation,
        workOrderId: input.workOrderId,
        customerId: input.customerId,
        subjectId: input.subjectId,
        instrumentIds,
        now: input.now,
        expiresAt,
      }),
    );

  const researchTriggers = dislocations
    .map((dislocation) =>
      buildCrossMarketResearchTriggerProposal({
        dislocation,
        customerId: String(input.customerId),
        subjectId: input.subjectId,
        now: input.now,
      }),
    )
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return Object.freeze({
    runId: input.runId,
    graph,
    probabilityStates,
    dislocations,
    confirmations,
    contradictions,
    opportunityCandidates: Object.freeze(opportunityCandidates),
    researchTriggers: Object.freeze(researchTriggers),
    evaluatedAt: input.now,
    grantsExecutionAuthority: false as const,
    authorizesFinancialExecution: false as const,
  });
}
