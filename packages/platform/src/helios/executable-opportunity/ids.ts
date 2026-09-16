import { type Brand, brandAs } from '../../../../domain/src/brand.ts';

export type OpportunityCandidateId = Brand<string, 'OpportunityCandidateId'>;
export type ExecutableOpportunityId = Brand<string, 'ExecutableOpportunityId'>;
export type QualificationDecisionId = Brand<string, 'QualificationDecisionId'>;

const PREFIX = {
  OpportunityCandidateId: 'opc_',
  ExecutableOpportunityId: 'xop_',
  QualificationDecisionId: 'oqd_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asOpportunityCandidateId(value: string): OpportunityCandidateId {
  return brandPrefixed(value, 'OpportunityCandidateId');
}

export function asExecutableOpportunityId(value: string): ExecutableOpportunityId {
  return brandPrefixed(value, 'ExecutableOpportunityId');
}

export function asQualificationDecisionId(value: string): QualificationDecisionId {
  return brandPrefixed(value, 'QualificationDecisionId');
}

export function candidateIdFor(workOrderId: string, key: string): OpportunityCandidateId {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return asOpportunityCandidateId(`opc_${workOrderId}_${safe}`);
}

export function executableOpportunityIdFor(candidateId: string, sequence = 1): ExecutableOpportunityId {
  return asExecutableOpportunityId(`xop_${candidateId}_${String(sequence)}`);
}

export function qualificationDecisionIdFor(executableOpportunityId: string, stage: string): QualificationDecisionId {
  const safe = stage.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  return asQualificationDecisionId(`oqd_${executableOpportunityId}_${safe}`);
}
