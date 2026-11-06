import { type Brand, brandAs } from '@solstice/domain';

export type EvolutionProgramId = Brand<string, 'EvolutionProgramId'>;
export type EvolutionRunId = Brand<string, 'EvolutionRunId'>;
export type EvolutionGenerationId = Brand<string, 'EvolutionGenerationId'>;
export type GenomeCandidateId = Brand<string, 'GenomeCandidateId'>;
export type GenomePopulationId = Brand<string, 'GenomePopulationId'>;
export type GenomeLineageEdgeId = Brand<string, 'GenomeLineageEdgeId'>;
export type EvolutionObjectiveId = Brand<string, 'EvolutionObjectiveId'>;
export type EvolutionBudgetId = Brand<string, 'EvolutionBudgetId'>;
export type EvolutionPolicyId = Brand<string, 'EvolutionPolicyId'>;
export type EvolutionEvidenceManifestId = Brand<string, 'EvolutionEvidenceManifestId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asEvolutionProgramId(value: string): EvolutionProgramId {
  return asPrefixed(value, 'evpr_', 'EvolutionProgramId');
}

export function asEvolutionRunId(value: string): EvolutionRunId {
  return asPrefixed(value, 'evrn_', 'EvolutionRunId');
}

export function asEvolutionGenerationId(value: string): EvolutionGenerationId {
  return asPrefixed(value, 'evgn_', 'EvolutionGenerationId');
}

export function asGenomeCandidateId(value: string): GenomeCandidateId {
  return asPrefixed(value, 'gcnd_', 'GenomeCandidateId');
}

export function asGenomePopulationId(value: string): GenomePopulationId {
  return asPrefixed(value, 'gpop_', 'GenomePopulationId');
}

export function asGenomeLineageEdgeId(value: string): GenomeLineageEdgeId {
  return asPrefixed(value, 'glne_', 'GenomeLineageEdgeId');
}

export function asEvolutionObjectiveId(value: string): EvolutionObjectiveId {
  return asPrefixed(value, 'evob_', 'EvolutionObjectiveId');
}

export function asEvolutionBudgetId(value: string): EvolutionBudgetId {
  return asPrefixed(value, 'evbd_', 'EvolutionBudgetId');
}

export function asEvolutionPolicyId(value: string): EvolutionPolicyId {
  return asPrefixed(value, 'evpl_', 'EvolutionPolicyId');
}

export function asEvolutionEvidenceManifestId(value: string): EvolutionEvidenceManifestId {
  return asPrefixed(value, 'evem_', 'EvolutionEvidenceManifestId');
}
