import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type CapitalMeshId = Brand<string, 'CapitalMeshId'>;
export type CapitalMeshRunId = Brand<string, 'CapitalMeshRunId'>;
export type CapitalAgentNodeId = Brand<string, 'CapitalAgentNodeId'>;
export type CapitalContextId = Brand<string, 'CapitalContextId'>;
export type CapitalThesisId = Brand<string, 'CapitalThesisId'>;
export type CapitalAllocationCandidateId = Brand<string, 'CapitalAllocationCandidateId'>;
export type CapitalProposalId = Brand<string, 'CapitalProposalId'>;
export type CapitalReviewId = Brand<string, 'CapitalReviewId'>;
export type CapitalArbitrationId = Brand<string, 'CapitalArbitrationId'>;
export type CapitalScenarioId = Brand<string, 'CapitalScenarioId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asCapitalMeshId(value: string): CapitalMeshId {
  return asPrefixed(value, 'cmsh_', 'CapitalMeshId');
}

export function asCapitalMeshRunId(value: string): CapitalMeshRunId {
  return asPrefixed(value, 'cmrun_', 'CapitalMeshRunId');
}

export function asCapitalAgentNodeId(value: string): CapitalAgentNodeId {
  return asPrefixed(value, 'cmnode_', 'CapitalAgentNodeId');
}

export function asCapitalContextId(value: string): CapitalContextId {
  return asPrefixed(value, 'cmctx_', 'CapitalContextId');
}

export function asCapitalThesisId(value: string): CapitalThesisId {
  return asPrefixed(value, 'cmth_', 'CapitalThesisId');
}

export function asCapitalAllocationCandidateId(value: string): CapitalAllocationCandidateId {
  return asPrefixed(value, 'cmac_', 'CapitalAllocationCandidateId');
}

export function asCapitalProposalId(value: string): CapitalProposalId {
  return asPrefixed(value, 'cmpr_', 'CapitalProposalId');
}

export function asCapitalReviewId(value: string): CapitalReviewId {
  return asPrefixed(value, 'cmrev_', 'CapitalReviewId');
}

export function asCapitalArbitrationId(value: string): CapitalArbitrationId {
  return asPrefixed(value, 'cmarb_', 'CapitalArbitrationId');
}

export function asCapitalScenarioId(value: string): CapitalScenarioId {
  return asPrefixed(value, 'cmsc_', 'CapitalScenarioId');
}
