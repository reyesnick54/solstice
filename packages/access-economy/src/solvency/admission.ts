/**
 * ACCESS-16 — Access pool admission gate.
 *
 * A capacity tranche may enter an Access pool only if all required
 * preconditions hold. Fail closed.
 */

import { isExternalFundedTranche } from './taxonomy.ts';
import type { PoolAdmissionInput, PoolAdmissionResult } from './types.ts';

export function evaluatePoolAdmission(input: PoolAdmissionInput): PoolAdmissionResult {
  if (input.tranche.allocatableUnits <= 0n) {
    return refuse('ZERO_CAPACITY', 'tranche has no allocatable capacity');
  }
  if (new Date(input.now).getTime() >= new Date(input.tranche.expiresAt).getTime()) {
    return refuse('EXPIRED_TRANCHE', 'tranche has expired');
  }
  if (!input.evidenceCurrent) {
    return refuse('STALE_EVIDENCE', 'evidence is not current');
  }
  if (!input.jurisdictionPermitted) {
    return refuse('JURISDICTION_DENIED', 'policy does not permit jurisdiction');
  }
  if (!input.providerCapabilityPermitsBooking) {
    return refuse('PROVIDER_CAPABILITY_DENIED', 'provider capability does not permit booking');
  }
  if (isExternalFundedTranche(input.tranche.kind)) {
    if (!input.settlementTermsPresent) {
      return refuse('SETTLEMENT_TERMS_MISSING', 'external tranche requires settlement terms');
    }
    if (!input.reserveAvailable) {
      return refuse('FUNDING_RESERVE_MISSING', 'external tranche requires funded settlement reserve');
    }
  }
  return Object.freeze({ admitted: true, refusalCode: null, refusalMessage: null });
}

function refuse(code: string, message: string): PoolAdmissionResult {
  return Object.freeze({ admitted: false, refusalCode: code, refusalMessage: message });
}
