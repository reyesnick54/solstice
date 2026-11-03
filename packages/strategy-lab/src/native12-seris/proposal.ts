import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { StrategySpecification } from '../specification.ts';
import type { ChronologicalWindow } from '../types.ts';
import type { StrategyGenome } from '../os05/types.ts';
import type { SerisSimulationMarketContext } from './market-context.ts';
import type { StrategySourceReview } from './source-review.ts';

export const SERIS_AI_STRATEGY_PROPOSAL_SCHEMA = 'helios.native12.seris-ai-strategy-proposal.v1' as const;

export type SerisAiStrategyProposal = {
  readonly schema: typeof SERIS_AI_STRATEGY_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly workOrderId: string | null;
  readonly genome: StrategyGenome;
  readonly specificationDraft: Omit<StrategySpecification, 'specificationId' | 'executableCode'>;
  readonly evaluationPlan: {
    readonly train: ChronologicalWindow;
    readonly validation: ChronologicalWindow;
    readonly holdout: ChronologicalWindow;
    readonly walkForward: { readonly trainDays: number; readonly testDays: number };
  };
  readonly marketContext: SerisSimulationMarketContext;
  readonly sourceReview: StrategySourceReview;
  readonly researchAgentRef: string;
  readonly proposedAt: UtcInstant;
  readonly deployRequested: false;
  readonly materialHash: string;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export function buildSerisAiStrategyProposal(input: {
  readonly proposalId?: string;
  readonly workOrderId?: string | null;
  readonly genome: StrategyGenome;
  readonly specificationDraft: SerisAiStrategyProposal['specificationDraft'];
  readonly evaluationPlan: SerisAiStrategyProposal['evaluationPlan'];
  readonly marketContext: SerisSimulationMarketContext;
  readonly sourceReview: StrategySourceReview;
  readonly researchAgentRef: string;
  readonly proposedAt: UtcInstant;
}): SerisAiStrategyProposal {
  const body = {
    workOrderId: input.workOrderId ?? null,
    genome: input.genome,
    specificationDraft: input.specificationDraft,
    evaluationPlan: input.evaluationPlan,
    marketContext: input.marketContext,
    sourceReview: input.sourceReview,
    researchAgentRef: input.researchAgentRef,
    proposedAt: input.proposedAt,
    deployRequested: false as const,
  };
  const materialHash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  const proposalId =
    input.proposalId ?? `sn12_${createHash('sha256').update(materialHash).digest('hex').slice(0, 20)}`;
  return Object.freeze({
    schema: SERIS_AI_STRATEGY_PROPOSAL_SCHEMA,
    proposalId,
    workOrderId: input.workOrderId ?? null,
    genome: input.genome,
    specificationDraft: input.specificationDraft,
    evaluationPlan: input.evaluationPlan,
    marketContext: input.marketContext,
    sourceReview: input.sourceReview,
    researchAgentRef: input.researchAgentRef,
    proposedAt: input.proposedAt,
    deployRequested: false,
    materialHash,
  });
}
