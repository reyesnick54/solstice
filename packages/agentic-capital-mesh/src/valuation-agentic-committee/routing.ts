import type { ValuationCommitteePhase, ValuationCommitteeRole } from './taxonomy.ts';
import {
  VALUATION_ADVOCACY_ROLES,
  VALUATION_ANALYST_SPECIALIST_ROLES,
  VALUATION_COMMITTEE_PHASES,
  VALUATION_REVIEW_ROLES,
} from './taxonomy.ts';

export const DEFAULT_VALUATION_COMMITTEE_PIPELINE: readonly ValuationCommitteePhase[] = Object.freeze([
  ...VALUATION_COMMITTEE_PHASES,
]);

export function rolesForValuationPhase(phase: ValuationCommitteePhase): readonly ValuationCommitteeRole[] {
  switch (phase) {
    case 'EVIDENCE_FREEZE':
    case 'CANONICAL_FACTS_BIND':
    case 'ASSUMPTION_CHALLENGE_STATE':
    case 'H20_SPECIALIST_ASSIGNMENT':
      return Object.freeze([]);
    case 'SPECIALIST_ANALYSIS':
      return VALUATION_ANALYST_SPECIALIST_ROLES;
    case 'ADVOCACY_DEBATE':
      return VALUATION_ADVOCACY_ROLES;
    case 'RISK_REVIEW':
      return VALUATION_REVIEW_ROLES;
    case 'CONTRADICTION_CHALLENGE':
      return VALUATION_ANALYST_SPECIALIST_ROLES;
    case 'SYNTHESIS':
      return Object.freeze(['VALUATION_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
