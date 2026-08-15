import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type AgentProposalId = Brand<string, 'AgentProposalId'>;
export type AgentInterpretationId = Brand<string, 'AgentInterpretationId'>;

export function asAgentProposalId(value: string): AgentProposalId {
  if (value.length === 0 || !value.startsWith('agp_')) {
    throw new TypeError('AgentProposalId must start with agp_');
  }
  return brandAs<string, 'AgentProposalId'>(value);
}

export function asAgentInterpretationId(value: string): AgentInterpretationId {
  if (value.length === 0 || !value.startsWith('agi_')) {
    throw new TypeError('AgentInterpretationId must start with agi_');
  }
  return brandAs<string, 'AgentInterpretationId'>(value);
}

export function deterministicProposalId(kind: string, key: string): AgentProposalId {
  return asAgentProposalId(`agp_${kind.toLowerCase()}_${key}`);
}

export function deterministicInterpretationId(subjectId: string, version: number): AgentInterpretationId {
  return asAgentInterpretationId(`agi_${subjectId}_v${String(version)}`);
}
