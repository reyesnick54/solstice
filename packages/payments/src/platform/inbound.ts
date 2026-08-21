/**
 * Provider-neutral inbound funding foundation.
 *
 * An unverified HTTP request must never credit the ledger.
 * Later: verified provider event → reconciliation → policy → Ledger credit → evidence.
 */

export const INBOUND_NOTICE_STATUSES = [
  'RECEIVED_UNVERIFIED',
  'REJECTED_UNVERIFIED',
  'VERIFIED',
  'AWAITING_POLICY',
  'CREDITED',
  'REJECTED',
] as const;
export type InboundNoticeStatus = (typeof INBOUND_NOTICE_STATUSES)[number];

export type InboundFundingNotice = {
  readonly noticeId: string;
  readonly provider: string;
  readonly rail: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly destinationAccountHint: string;
  readonly providerEventId: string | null;
  readonly payloadHash: string;
  readonly verified: boolean;
  readonly status: InboundNoticeStatus;
  readonly creditJournalId: string | null;
  readonly reason: string | null;
};

export type InboundVerification =
  | { readonly ok: true; readonly providerEventId: string; readonly payloadHash: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Ingest only. Credit happens later through PaymentsService.acceptInboundPayment
 * after verification + Kernel.
 */
export function admitInboundNotice(input: {
  readonly noticeId: string;
  readonly provider: string;
  readonly rail: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly destinationAccountHint: string;
  readonly providerEventId: string | null;
  readonly payloadHash: string;
  readonly verification: InboundVerification;
}): InboundFundingNotice {
  if (!input.verification.ok) {
    return Object.freeze({
      noticeId: input.noticeId,
      provider: input.provider,
      rail: input.rail,
      amountMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      destinationAccountHint: input.destinationAccountHint,
      providerEventId: input.providerEventId,
      payloadHash: input.payloadHash,
      verified: false,
      status: 'REJECTED_UNVERIFIED',
      creditJournalId: null,
      reason: input.verification.reason,
    });
  }
  return Object.freeze({
    noticeId: input.noticeId,
    provider: input.provider,
    rail: input.rail,
    amountMinorUnits: input.amountMinorUnits,
    currency: input.currency,
    destinationAccountHint: input.destinationAccountHint,
    providerEventId: input.verification.providerEventId,
    payloadHash: input.verification.payloadHash,
    verified: true,
    status: 'VERIFIED',
    creditJournalId: null,
    reason: null,
  });
}

export function inboundMustNotCredit(notice: InboundFundingNotice): boolean {
  return notice.status === 'RECEIVED_UNVERIFIED' || notice.status === 'REJECTED_UNVERIFIED' || !notice.verified;
}
