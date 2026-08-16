import { randomUUID } from 'node:crypto';

export const INFORMATION_MARKET_ID_PREFIXES = Object.freeze({
  requester: 'imr_',
  request: 'imq_',
  opportunity: 'imo_',
  match: 'imm_',
  attestation: 'ima_',
  contribution: 'imc_',
  agreement: 'img_',
  settlement: 'ims_',
  observation: 'imx_',
  subject: 'imsj_',
});

export type RequesterId = string & { readonly __brand: 'RequesterId' };
export type MarketRequestId = string & { readonly __brand: 'MarketRequestId' };
export type OpportunityId = string & { readonly __brand: 'OpportunityId' };
export type EligibilityMatchId = string & { readonly __brand: 'EligibilityMatchId' };
export type AttestationId = string & { readonly __brand: 'AttestationId' };
export type ContributionId = string & { readonly __brand: 'ContributionId' };
export type CompensationAgreementId = string & { readonly __brand: 'CompensationAgreementId' };
export type SettlementRefId = string & { readonly __brand: 'SettlementRefId' };

function mint(prefix: string): string {
  return `${prefix}${randomUUID()}`;
}

export function newRequesterId(): RequesterId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.requester) as RequesterId;
}
export function newMarketRequestId(): MarketRequestId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.request) as MarketRequestId;
}
export function newOpportunityId(): OpportunityId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.opportunity) as OpportunityId;
}
export function newEligibilityMatchId(): EligibilityMatchId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.match) as EligibilityMatchId;
}
export function newAttestationId(): AttestationId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.attestation) as AttestationId;
}
export function newContributionId(): ContributionId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.contribution) as ContributionId;
}
export function newCompensationAgreementId(): CompensationAgreementId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.agreement) as CompensationAgreementId;
}
export function newSettlementRefId(): SettlementRefId {
  return mint(INFORMATION_MARKET_ID_PREFIXES.settlement) as SettlementRefId;
}

export function requesterIdFor(slug: string): RequesterId {
  return `${INFORMATION_MARKET_ID_PREFIXES.requester}${slug}` as RequesterId;
}

export function subjectRefFor(subjectId: string): string {
  return `${INFORMATION_MARKET_ID_PREFIXES.subject}${subjectId}`;
}
