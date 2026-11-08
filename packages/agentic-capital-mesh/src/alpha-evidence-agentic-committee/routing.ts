import type { Alpha14CommitteePhase, Alpha14CommitteeRole } from './taxonomy.ts';
import { ALPHA14_COMMITTEE_PHASES, ALPHA14_COMMITTEE_ROLES } from './taxonomy.ts';

export const DEFAULT_ALPHA14_COMMITTEE_PIPELINE: readonly Alpha14CommitteePhase[] = Object.freeze([
  ...ALPHA14_COMMITTEE_PHASES,
]);

export function rolesForAlpha14Phase(phase: Alpha14CommitteePhase): readonly Alpha14CommitteeRole[] {
  switch (phase) {
    case 'EVIDENCE_FREEZE':
    case 'CLAIM_ENVELOPE':
      return Object.freeze([]);
    case 'PERFORMANCE_AND_BENCHMARK':
      return Object.freeze(['FORWARD_PERFORMANCE', 'BENCHMARK']);
    case 'STATISTICAL_SCRUTINY':
      return Object.freeze(['STATISTICAL_SKEPTIC', 'MULTIPLE_TESTING_AUDITOR']);
    case 'IMPLEMENTATION_AND_DATA':
      return Object.freeze(['EXECUTION_REALITY', 'DATA_INTEGRITY']);
    case 'REGIME_CAPACITY_DECAY':
      return Object.freeze(['REGIME_ROBUSTNESS', 'CAPACITY', 'ALPHA_DECAY']);
    case 'ADVERSARIAL_SKEPTIC_PASS':
      return Object.freeze(['COUNTERFACTUAL_SKEPTIC']);
    case 'SYNTHESIS':
      return Object.freeze(['ALPHA_EVIDENCE_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function defaultAlpha14CommitteeRoles(): readonly Alpha14CommitteeRole[] {
  return Object.freeze(DEFAULT_ALPHA14_COMMITTEE_PIPELINE.flatMap((phase) => [...rolesForAlpha14Phase(phase)]));
}

export function allAlpha14RolesRegistered(): boolean {
  return defaultAlpha14CommitteeRoles().length === ALPHA14_COMMITTEE_ROLES.length;
}
