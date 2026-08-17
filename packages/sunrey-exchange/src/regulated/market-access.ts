import type { MarketAccessDecision, MarketAccessInput } from './types.ts';

export type { MarketAccessDecision, MarketAccessInput };

export function evaluateMarketAccess(input: MarketAccessInput): MarketAccessDecision {
  const reasons: string[] = [];
  if (input.deniedJurisdictions?.includes(input.jurisdiction)) {
    reasons.push('JURISDICTION_DENIED');
  }
  if (input.complianceState === 'BLOCK' || input.complianceState === 'UNAVAILABLE') {
    reasons.push('COMPLIANCE_STATE_DENIED');
  }
  if (input.riskRestricted) {
    reasons.push('RISK_RESTRICTED');
  }
  if (!input.listingAllowed) {
    reasons.push('LISTING_POLICY_DENIED');
  }
  if (input.marketFamily === 'HUMAN_INFORMATION_RIGHT' && (!input.consentReady || !input.rightsReady)) {
    reasons.push('HIR_PRIVACY_DEFAULT_DENY');
  }
  if (input.identityClass === 'INSTITUTIONAL' && !input.institutionalStatus) {
    reasons.push('INSTITUTIONAL_STATUS_REQUIRED');
  }
  if (input.identityClass === 'PROFESSIONAL' && !input.professionalStatus) {
    reasons.push('PROFESSIONAL_STATUS_REQUIRED');
  }
  return Object.freeze({
    allowed: reasons.length === 0,
    marketFamily: input.marketFamily,
    inheritedFamilyStatus: false,
    reasonCodes: Object.freeze(reasons.length === 0 ? ['ELIGIBLE'] : reasons),
  });
}

export function familyInheritsRegulatoryStatus(): false {
  return false;
}
