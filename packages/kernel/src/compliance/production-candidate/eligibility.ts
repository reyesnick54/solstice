import type { IdentityVerificationState } from '../../../../identity/src/production-candidate/types.ts';
import type { NormalizedComplianceFinding } from './types.ts';

/**
 * Facts for existing Exchange and custody gates. This module does not
 * evaluate eligibility itself and cannot bypass those owners.
 */
export type ExchangeComplianceFact = {
  readonly complianceState: 'CLEAR' | 'RESTRICTED';
  readonly reasonCodes: readonly string[];
  readonly sourceFindingId: string | null;
  readonly bypassesExchangeAuthority: false;
};

export type CustodyComplianceFact = {
  readonly kycState: 'VERIFIED' | 'IN_PROGRESS' | 'FAILED' | 'EXPIRED' | 'NOT_STARTED';
  readonly kycFresh: boolean;
  readonly screeningRestricted: boolean;
  readonly travelRulePending: boolean;
  readonly bypassesCustodyAuthority: false;
};

export function toExchangeComplianceFact(
  finding: NormalizedComplianceFinding | null,
): ExchangeComplianceFact {
  if (!finding) {
    return Object.freeze({
      complianceState: 'CLEAR',
      reasonCodes: Object.freeze([]),
      sourceFindingId: null,
      bypassesExchangeAuthority: false,
    });
  }
  const restricted =
    finding.policyResult === 'REVIEW' ||
    finding.policyResult === 'HOLD' ||
    finding.policyResult === 'BLOCK' ||
    finding.policyResult === 'UNAVAILABLE' ||
    finding.matchState === 'POSSIBLE_MATCH' ||
    finding.matchState === 'CONFIRMED_MATCH';
  return Object.freeze({
    complianceState: restricted ? 'RESTRICTED' : 'CLEAR',
    reasonCodes: finding.reasonCodes,
    sourceFindingId: finding.findingId,
    bypassesExchangeAuthority: false,
  });
}

export function toCustodyComplianceFact(input: {
  readonly verificationState: IdentityVerificationState | string;
  readonly finding?: NormalizedComplianceFinding | null;
  readonly travelRulePending?: boolean;
}): CustodyComplianceFact {
  const kycState =
    input.verificationState === 'VERIFIED' ||
    input.verificationState === 'IN_PROGRESS' ||
    input.verificationState === 'FAILED' ||
    input.verificationState === 'EXPIRED'
      ? input.verificationState
      : input.verificationState === 'REQUIRES_REVIEW'
        ? 'IN_PROGRESS'
        : 'NOT_STARTED';
  const fact = toExchangeComplianceFact(input.finding ?? null);
  return Object.freeze({
    kycState,
    kycFresh: kycState === 'VERIFIED',
    screeningRestricted: fact.complianceState === 'RESTRICTED',
    travelRulePending: input.travelRulePending === true,
    bypassesCustodyAuthority: false,
  });
}
