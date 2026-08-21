/**
 * Recovery gates for provider, database, HSM, oracle, payment, and supply.
 *
 * Restored application databases are not native-asset supply or final
 * chain history. Payment SUBMISSION_UNKNOWN still queries before retry.
 * Existing payments, custody, and persistence owners remain authoritative;
 * this module records the operational gate, it does not reimplement them.
 */

import { emptyBook, expectedTotal, observedTotal } from '../../economics/supply.ts';
import type { NativeMonetaryAssetId } from '../../economics/types.ts';
import type {
  HsmCompromiseRecovery,
  PaymentUnknownRecovery,
  RecoveryDomain,
  RecoveryGate,
  SupplyMismatchIncident,
} from './types.ts';

export function evaluateRecoveryGate(input: {
  readonly domain: RecoveryDomain;
  readonly reconciled: boolean;
  readonly rootCauseAddressed?: boolean;
}): RecoveryGate {
  const reasons: string[] = [];
  if (!input.reconciled) {
    reasons.push('reconciliation required before consequential workflows resume');
  }
  if (input.rootCauseAddressed === false) {
    reasons.push('root cause still open');
  }
  const state = reasons.length === 0 ? 'READY_FOR_RESUMPTION_REVIEW' : 'RECONCILIATION_REQUIRED';
  return Object.freeze({
    domain: input.domain,
    state,
    reconciled: input.reconciled,
    restoredApplicationDbIsSupplyAuthority: false,
    restoredApplicationDbIsChainHistory: false,
    reasons: Object.freeze(reasons),
  });
}

export function recoverDatabase(input: { readonly reconciled: boolean }): RecoveryGate {
  return evaluateRecoveryGate({
    domain: 'DATABASE',
    reconciled: input.reconciled,
  });
}

export function mismatchedSupplyBook(assetId: NativeMonetaryAssetId = 'SUNREY_COIN') {
  const book = emptyBook(assetId, 'rehearsal');
  book.genesisAllocated = 100n;
  book.circulating = 40n;
  return book;
}

export function supplyMismatchIncident(assetId: NativeMonetaryAssetId = 'MOONREY_COIN'): SupplyMismatchIncident | null {
  const book = mismatchedSupplyBook(assetId);
  if (expectedTotal(book) === observedTotal(book)) {
    return null;
  }
  return Object.freeze({
    severity: 'CRITICAL',
    newIssuanceRestricted: true,
    supplyNumbersEditedToMatch: false,
    reconciliationRequired: true,
  });
}

export function recoverPaymentUnknown(): PaymentUnknownRecovery {
  return Object.freeze({
    decision: 'QUERY',
    queryRequiredBeforeRetry: true,
    incidentPressureAuthorizesBlindResubmission: false,
    retryClass: 'DO_NOT_RETRY_WITHOUT_QUERY',
  });
}

export function recoverHsmCompromise(): HsmCompromiseRecovery {
  return Object.freeze({
    signingDisabled: true,
    credentialBindingsRevoked: true,
    signingRouteSuspended: true,
    priorSignaturesPreserved: true,
    recoveryCeremonyStarted: true,
    assetsTransferredAutomatically: false,
  });
}

export function complianceOutageFailsClosed(): { readonly failClosed: true; readonly regulatedActionsBlocked: true } {
  return Object.freeze({
    failClosed: true,
    regulatedActionsBlocked: true,
  });
}
