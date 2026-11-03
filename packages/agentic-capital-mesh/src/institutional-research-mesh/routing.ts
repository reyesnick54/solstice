import type { InstitutionalMeshPhase, InstitutionalResearchRole } from './types.ts';

export const DEFAULT_INSTITUTIONAL_MESH_PIPELINE: readonly InstitutionalMeshPhase[] = Object.freeze([
  'ANALYST_COVERAGE',
  'ADVOCACY_DEBATE',
  'RISK_REVIEW',
  'EXECUTION_RESEARCH',
  'SYNTHESIS',
]);

const ANALYST_ROLES: readonly InstitutionalResearchRole[] = Object.freeze([
  'FUNDAMENTAL_RESEARCH',
  'EARNINGS_RESEARCH',
  'TECHNICAL_RESEARCH',
  'MACRO_RESEARCH',
  'NEWS_RESEARCH',
  'SENTIMENT_RESEARCH',
  'OPTIONS_RESEARCH',
  'FLOW_RESEARCH',
  'CRYPTO_ONCHAIN_RESEARCH',
]);

const ADVOCACY_ROLES: readonly InstitutionalResearchRole[] = Object.freeze(['BULL_RESEARCH', 'BEAR_RESEARCH']);

export function rolesForPhase(phase: InstitutionalMeshPhase): readonly InstitutionalResearchRole[] {
  switch (phase) {
    case 'ANALYST_COVERAGE':
      return ANALYST_ROLES;
    case 'ADVOCACY_DEBATE':
      return ADVOCACY_ROLES;
    case 'RISK_REVIEW':
      return Object.freeze(['RISK_RESEARCH']);
    case 'EXECUTION_RESEARCH':
      return Object.freeze(['EXECUTION_RESEARCH']);
    case 'SYNTHESIS':
      return Object.freeze(['RESEARCH_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function defaultInstitutionalRoles(): readonly InstitutionalResearchRole[] {
  return Object.freeze(DEFAULT_INSTITUTIONAL_MESH_PIPELINE.flatMap((phase) => [...rolesForPhase(phase)]));
}
