/**
 * Complete evidence-chain and authorizer checks for production-candidate
 * settlement. No intermediate artifact is sufficient. Authorization
 * cannot mint.
 */

import {
  REQUIRED_SETTLEMENT_EVIDENCE,
  productionConversionRefuse,
  type ProductionCandidateSettlementEvidence,
  type ProductionConversionRefusal,
} from './types.ts';

export const COMPLETE_SETTLEMENT_EVIDENCE: ProductionCandidateSettlementEvidence = Object.freeze({
  verifiedContribution: true,
  eventIdentity: true,
  eventFingerprint: true,
  normalizationReceipt: true,
  attributionDecision: true,
  productiveValueResult: true,
  productiveValueDigest: true,
  pvfPolicy: true,
  conversionPolicy: true,
  settlementAuthorization: true,
  chunk71MonetaryEvidence: true,
});

export function validateCompleteEvidence(
  evidence?: Partial<ProductionCandidateSettlementEvidence>,
): ProductionConversionRefusal | null {
  if (!evidence) {
    return productionConversionRefuse('INCOMPLETE_EVIDENCE_CHAIN', 'production-candidate settlement requires the full evidence chain');
  }
  for (const key of REQUIRED_SETTLEMENT_EVIDENCE) {
    if (evidence[key] !== true) {
      return productionConversionRefuse('INCOMPLETE_EVIDENCE_CHAIN', `${key} is required; no intermediate artifact is sufficient`);
    }
  }
  return null;
}

export function validateConversionAuthorizer(actor?: string): ProductionConversionRefusal | null {
  if (!actor) {
    return null;
  }
  if (actor === 'AI') {
    return productionConversionRefuse('AI_CANNOT_AUTHORIZE', 'AI cannot authorize conversion');
  }
  if (actor === 'S3M') {
    return productionConversionRefuse('S3M_CANNOT_AUTHORIZE', 'S3M cannot authorize conversion');
  }
  if (actor === 'GROK' || actor === 'MODEL') {
    return productionConversionRefuse('GROK_CANNOT_AUTHORIZE', `${actor} cannot authorize conversion`);
  }
  if (actor === 'ORACLE_PROVIDER' || actor === 'DATA_PROVIDER' || actor === 'PRODUCTIVE_CONTROLLER') {
    return productionConversionRefuse('PROVIDER_CANNOT_AUTHORIZE', `${actor} cannot authorize conversion`);
  }
  if (actor === 'FINANCIAL_AGENT') {
    return productionConversionRefuse('AI_CANNOT_AUTHORIZE', 'financial agents cannot authorize conversion');
  }
  return null;
}

export function gpuvResultCannotMint(): false {
  return false;
}

export function conversionAuthorizationCannotMint(): false {
  return false;
}

export function chunk71RemainsMintGate(): true {
  return true;
}
