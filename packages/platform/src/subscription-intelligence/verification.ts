import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubscriptionActionProposal } from './models.ts';
import type { ProviderActionResult } from './provider.ts';

export type VerificationOutcome =
  | {
      readonly verified: true;
      readonly state: 'CONFIRMED';
      readonly requestSent: true;
      readonly actionConfirmed: true;
      readonly providerId: string;
      readonly providerEvidenceRef: string;
    }
  | {
      readonly verified: false;
      readonly state: 'EXECUTING' | 'FAILED';
      readonly requestSent: boolean;
      readonly actionConfirmed: false;
      readonly providerId: string | null;
      readonly providerEvidenceRef: string | null;
      readonly failureReason: string;
    };

/**
 * Separate REQUEST SENT from ACTION CONFIRMED.
 */
export function verifyProviderResult(
  action: SubscriptionActionProposal,
  result: ProviderActionResult,
  now: UtcInstant,
): { readonly action: SubscriptionActionProposal; readonly verification: VerificationOutcome } {
  if (result.outcome === 'CONFIRMED') {
    const updated: SubscriptionActionProposal = Object.freeze({
      ...action,
      state: 'CONFIRMED',
      requestSent: true,
      actionConfirmed: true,
      providerId: result.providerId,
      providerEvidenceRef: result.evidenceRef,
      completedAt: now,
      failureReason: null,
    });
    return Object.freeze({
      action: updated,
      verification: Object.freeze({
        verified: true,
        state: 'CONFIRMED',
        requestSent: true,
        actionConfirmed: true,
        providerId: result.providerId,
        providerEvidenceRef: result.evidenceRef,
      }),
    });
  }

  if (result.outcome === 'REQUEST_SENT') {
    const updated: SubscriptionActionProposal = Object.freeze({
      ...action,
      state: 'EXECUTING',
      requestSent: true,
      actionConfirmed: false,
      providerId: result.providerId,
      providerEvidenceRef: result.evidenceRef,
      failureReason: null,
    });
    return Object.freeze({
      action: updated,
      verification: Object.freeze({
        verified: false,
        state: 'EXECUTING',
        requestSent: true,
        actionConfirmed: false,
        providerId: result.providerId,
        providerEvidenceRef: result.evidenceRef,
        failureReason: 'Awaiting provider confirmation',
      }),
    });
  }

  const updated: SubscriptionActionProposal = Object.freeze({
    ...action,
    state: 'FAILED',
    requestSent: false,
    actionConfirmed: false,
    providerId: result.providerId,
    providerEvidenceRef: null,
    completedAt: now,
    failureReason: result.message,
  });
  return Object.freeze({
    action: updated,
    verification: Object.freeze({
      verified: false,
      state: 'FAILED',
      requestSent: false,
      actionConfirmed: false,
      providerId: result.providerId,
      providerEvidenceRef: null,
      failureReason: result.message,
    }),
  });
}
