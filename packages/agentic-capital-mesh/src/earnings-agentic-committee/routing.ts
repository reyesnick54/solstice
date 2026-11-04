import type { EarningsCommitteePhase, EarningsCommitteeRole } from './taxonomy.ts';
import {
  EARNINGS_ADVOCACY_ROLES,
  EARNINGS_ANALYST_SPECIALIST_ROLES,
  EARNINGS_COMMITTEE_PHASES,
  EARNINGS_REVIEW_ROLES,
} from './taxonomy.ts';

export const DEFAULT_EARNINGS_COMMITTEE_PIPELINE: readonly EarningsCommitteePhase[] = Object.freeze([
  ...EARNINGS_COMMITTEE_PHASES,
]);

export function rolesForEarningsPhase(phase: EarningsCommitteePhase): readonly EarningsCommitteeRole[] {
  switch (phase) {
    case 'EVIDENCE_FREEZE':
    case 'PROBABILISTIC_STATE':
    case 'H20_SPECIALIST_ASSIGNMENT':
      return Object.freeze([]);
    case 'SPECIALIST_ANALYSIS':
      return EARNINGS_ANALYST_SPECIALIST_ROLES;
    case 'ADVOCACY_DEBATE':
      return EARNINGS_ADVOCACY_ROLES;
    case 'FORENSIC_REVIEW':
      return Object.freeze(['FORENSIC_ACCOUNTING']);
    case 'RISK_REVIEW':
      return Object.freeze(['RISK_EARNINGS']);
    case 'CONTRADICTION_CHALLENGE':
      return EARNINGS_ANALYST_SPECIALIST_ROLES;
    case 'SYNTHESIS':
      return Object.freeze(['EARNINGS_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
