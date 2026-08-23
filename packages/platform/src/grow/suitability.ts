import type { SuitabilityOutcome } from './taxonomy.ts';

export type SuitabilityFacts = {
  readonly kycComplete: boolean;
  readonly jurisdictionPermitted: boolean;
  readonly accountRestricted: boolean;
  readonly customerEligible: boolean;
  readonly riskProfile: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  readonly proposalRiskClass: 'LOW' | 'MODERATE' | 'HIGH' | 'UNCERTAIN_MARKET';
};

/**
 * Consumes existing risk/eligibility facts. Not a second RiskEngine.
 */
export function evaluateGrowSuitability(facts: SuitabilityFacts): SuitabilityOutcome {
  if (!facts.kycComplete) {
    return 'KYC_INCOMPLETE';
  }
  if (!facts.jurisdictionPermitted) {
    return 'JURISDICTION_BLOCKED';
  }
  if (facts.accountRestricted) {
    return 'ACCOUNT_RESTRICTED';
  }
  if (!facts.customerEligible) {
    return 'UNSUITABLE';
  }
  if (facts.riskProfile === 'UNKNOWN') {
    return 'INSUFFICIENT_PROFILE';
  }
  if (facts.proposalRiskClass === 'HIGH' && facts.riskProfile === 'LOW') {
    return 'UNSUITABLE';
  }
  if (facts.proposalRiskClass === 'UNCERTAIN_MARKET' && facts.riskProfile === 'LOW') {
    return 'UNSUITABLE';
  }
  return 'SUITABLE';
}

export function suitabilityBlocksExecution(outcome: SuitabilityOutcome): boolean {
  return outcome !== 'SUITABLE';
}
