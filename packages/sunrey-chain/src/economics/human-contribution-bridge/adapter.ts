/**
 * Narrow adapter from a privacy-safe valuation result to a
 * settlement-authorization candidate. Does not import the Human
 * Contribution Registry implementation.
 */

import { firewallRejection, isSha256Hex } from './firewall.ts';
import type {
  BridgeRejection,
  EngineValuationReference,
  EngineValuationSettlementCandidate,
} from './types.ts';

export function toSettlementAuthorizationCandidate(
  valuation: EngineValuationReference,
):
  | { readonly ok: true; readonly candidate: EngineValuationSettlementCandidate }
  | { readonly ok: false; readonly code: BridgeRejection } {
  const poisoned = firewallRejection(valuation);
  if (poisoned) {
    return { ok: false, code: poisoned };
  }
  if (valuation.environment === 'PRODUCTION' || valuation.productionActivated) {
    return { ok: false, code: 'PRODUCTION_VALUATION_UNAVAILABLE' };
  }
  if (valuation.status !== 'ACTIVE') {
    return { ok: false, code: 'VALUATION_REQUIRED' };
  }
  if (!valuation.valuationId || !valuation.contributionId || !valuation.fingerprint) {
    return { ok: false, code: 'INVALID_CONTRIBUTION' };
  }
  if (!isSha256Hex(valuation.valuationDigest)) {
    return { ok: false, code: 'VALUATION_DIGEST_INVALID' };
  }
  if (valuation.finalReferenceValue <= 0n) {
    return { ok: false, code: 'VALUATION_REQUIRED' };
  }
  if (valuation.peveUsedAsTokenFormula) {
    return { ok: false, code: 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY' };
  }
  if (valuation.humanWorthUsedAsValue) {
    return { ok: false, code: 'HUMAN_WORTH_SCORE_REJECTED' };
  }
  if (valuation.aiAuthorized) {
    return { ok: false, code: 'AI_CANNOT_AUTHORIZE_ISSUANCE' };
  }
  return {
    ok: true,
    candidate: Object.freeze({
      valuationId: valuation.valuationId,
      contributionId: valuation.contributionId,
      fingerprint: valuation.fingerprint,
      valuationPolicyId: valuation.valuationPolicyId,
      valuationPolicyVersion: valuation.valuationPolicyVersion,
      valuationMethod: valuation.valuationMethod,
      valuationDigest: valuation.valuationDigest,
      finalReferenceValue: valuation.finalReferenceValue,
      referenceDenomination: valuation.referenceDenomination,
      jurisdictionPolicyRef: valuation.jurisdictionPolicyRef,
      mappingIsIssuanceAuthorization: false,
      containsRawPersonalData: false,
    }),
  };
}
