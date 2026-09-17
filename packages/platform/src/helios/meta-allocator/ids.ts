import { type Brand, brandAs } from '@solstice/domain';

export type MetaAllocationRunId = Brand<string, 'MetaAllocationRunId'>;
export type MetaAllocationDecisionId = Brand<string, 'MetaAllocationDecisionId'>;
export type MetaAllocationCandidateId = Brand<string, 'MetaAllocationCandidateId'>;
export type CapitalRecommendationId = Brand<string, 'CapitalRecommendationId'>;
export type ResearchSpendRecommendationId = Brand<string, 'ResearchSpendRecommendationId'>;

const PREFIX = {
  MetaAllocationRunId: 'mar_',
  MetaAllocationDecisionId: 'mad_',
  MetaAllocationCandidateId: 'mac_',
  CapitalRecommendationId: 'mcr_',
  ResearchSpendRecommendationId: 'msr_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asMetaAllocationRunId(value: string): MetaAllocationRunId {
  return brandPrefixed(value, 'MetaAllocationRunId');
}

export function asMetaAllocationDecisionId(value: string): MetaAllocationDecisionId {
  return brandPrefixed(value, 'MetaAllocationDecisionId');
}

export function asMetaAllocationCandidateId(value: string): MetaAllocationCandidateId {
  return brandPrefixed(value, 'MetaAllocationCandidateId');
}

export function asCapitalRecommendationId(value: string): CapitalRecommendationId {
  return brandPrefixed(value, 'CapitalRecommendationId');
}

export function asResearchSpendRecommendationId(value: string): ResearchSpendRecommendationId {
  return brandPrefixed(value, 'ResearchSpendRecommendationId');
}

export function metaAllocationRunIdFor(workOrderId: string, key: string): MetaAllocationRunId {
  return asMetaAllocationRunId(`mar_${workOrderId}_${key}`);
}

export function metaAllocationDecisionIdFor(runId: string, candidateKey: string): MetaAllocationDecisionId {
  return asMetaAllocationDecisionId(`mad_${runId}_${candidateKey}`);
}

export function metaAllocationCandidateIdFor(workOrderId: string, key: string): MetaAllocationCandidateId {
  return asMetaAllocationCandidateId(`mac_${workOrderId}_${key}`);
}
