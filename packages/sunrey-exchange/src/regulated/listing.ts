import { evaluateListingGovernance } from '../instruments.ts';
import type { ExchangeInstrument } from '../types-universal.ts';

export type ProductionListingAuthorization = {
  readonly instrumentId: string;
  readonly technicalValidation: boolean;
  readonly riskAssessment: boolean;
  readonly marketFamilyPolicy: boolean;
  readonly securityReview: boolean;
  readonly legalRegulatoryEvidence: boolean;
  readonly authorizedListingDecision: boolean;
  readonly actorKind: 'HUMAN' | 'AI';
  readonly accepted: boolean;
  readonly reasonCodes: readonly string[];
  readonly aiMayAuthorize: false;
};

export function evaluateProductionListing(input: {
  readonly instrument: ExchangeInstrument;
  readonly riskAssessment: boolean;
  readonly securityReview: boolean;
  readonly legalRegulatoryEvidence: boolean;
  readonly authorizedBy: 'HUMAN' | 'AI';
}): ProductionListingAuthorization {
  const governance = evaluateListingGovernance(input.instrument);
  const reasons = [...governance.reasonCodes];
  if (!input.riskAssessment) {
    reasons.push('RISK_ASSESSMENT_MISSING');
  }
  if (!input.securityReview) {
    reasons.push('SECURITY_REVIEW_MISSING');
  }
  if (!input.legalRegulatoryEvidence) {
    reasons.push('LEGAL_REGULATORY_EVIDENCE_MISSING');
  }
  if (input.authorizedBy === 'AI') {
    reasons.push('AI_LISTING_AUTHORIZATION_REJECTED');
  }
  const accepted =
    governance.accepted &&
    input.riskAssessment &&
    input.securityReview &&
    input.legalRegulatoryEvidence &&
    input.authorizedBy === 'HUMAN';
  return Object.freeze({
    instrumentId: input.instrument.instrumentId,
    technicalValidation: governance.schemaValid,
    riskAssessment: input.riskAssessment,
    marketFamilyPolicy: governance.familyPolicyOk,
    securityReview: input.securityReview,
    legalRegulatoryEvidence: input.legalRegulatoryEvidence,
    authorizedListingDecision: input.authorizedBy === 'HUMAN',
    actorKind: input.authorizedBy,
    accepted,
    reasonCodes: Object.freeze(reasons),
    aiMayAuthorize: false,
  });
}
