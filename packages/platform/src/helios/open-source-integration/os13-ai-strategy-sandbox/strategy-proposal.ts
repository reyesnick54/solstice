import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { StrategySpecification } from '../../../../../strategy-lab/src/specification.ts';
import type { ChronologicalWindow } from '../../../../../strategy-lab/src/types.ts';
import { PROPOSED_STRATEGY_GENOME_SCHEMA, STRATEGY_PROPOSAL_SCHEMA } from './taxonomy.ts';

export type ProposedStrategyGenome = {
  readonly schema: typeof PROPOSED_STRATEGY_GENOME_SCHEMA;
  readonly specificationDraft: Omit<StrategySpecification, 'specificationId' | 'executableCode'>;
  readonly parameterSweep?: Readonly<Record<string, readonly string[]>>;
  readonly evaluationPlan: {
    readonly train: ChronologicalWindow;
    readonly validation: ChronologicalWindow;
    readonly holdout: ChronologicalWindow;
    readonly walkForward: {
      readonly trainDays: number;
      readonly testDays: number;
    };
  };
  readonly informationTimeAttestation: {
    readonly usesOnlyKnowableObservations: true;
    readonly dataRefs: readonly {
      readonly featureId: string;
      readonly knowableAt: UtcInstant;
      readonly evaluationHorizonStart: UtcInstant;
    }[];
  };
  readonly coverageReportRequired: true;
  readonly regimeBreakdownRequired: true;
};

export type StrategyProposal = {
  readonly schema: typeof STRATEGY_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly workOrderId: string | null;
  readonly researchAgentRef: string;
  readonly genome: ProposedStrategyGenome;
  readonly proposedAt: UtcInstant;
  readonly deployRequested: false;
  readonly materialHash: string;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export function buildStrategyProposal(input: {
  readonly proposalId?: string;
  readonly workOrderId?: string | null;
  readonly researchAgentRef: string;
  readonly genome: ProposedStrategyGenome;
  readonly proposedAt: UtcInstant;
}): StrategyProposal {
  if (input.genome.schema !== PROPOSED_STRATEGY_GENOME_SCHEMA) {
    throw new Error('ProposedStrategyGenome schema mismatch');
  }
  const body = {
    researchAgentRef: input.researchAgentRef,
    workOrderId: input.workOrderId ?? null,
    genome: input.genome,
    proposedAt: input.proposedAt,
    deployRequested: false as const,
  };
  const materialHash = createHash('sha256').update(canonicalJson(body)).digest('hex');
  const proposalId =
    input.proposalId ?? `spr_${createHash('sha256').update(materialHash).digest('hex').slice(0, 20)}`;
  return Object.freeze({
    schema: STRATEGY_PROPOSAL_SCHEMA,
    proposalId,
    workOrderId: input.workOrderId ?? null,
    researchAgentRef: input.researchAgentRef,
    genome: input.genome,
    proposedAt: input.proposedAt,
    deployRequested: false,
    materialHash,
  });
}
