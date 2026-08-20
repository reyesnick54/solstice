import { applyMonotonicState, type DomainTransitionFn } from './transitions.ts';

export const PAYMENT_STATUS_RANK = Object.freeze({
  DRAFT: 1,
  PENDING_COMPLIANCE: 2,
  READY: 3,
  FUNDS_RESERVED: 4,
  SUBMITTED: 10,
  SUBMISSION_UNKNOWN: 11,
  PROCESSING: 20,
  ACCEPTED: 21,
  PENDING: 15,
  SETTLED: 80,
  FAILED: 70,
  RETURNED: 85,
  CANCELLED: 60,
  HELD: 25,
});

export const CUSTODY_STATUS_RANK = Object.freeze({
  REQUESTED: 1,
  AUTHORIZED: 10,
  SUBMITTED: 20,
  SUBMISSION_UNKNOWN: 21,
  FINALIZED: 80,
  SETTLED: 85,
  FAILED: 70,
  BLOCKED: 60,
});

export const EXCHANGE_SETTLEMENT_RANK = Object.freeze({
  TRADE_RECORDED: 10,
  RESERVED: 20,
  DVP_IN_FLIGHT: 30,
  CHAIN_LEG_FINALIZED: 40,
  ACCOUNTING_UNCERTAIN: 35,
  SETTLED: 80,
  FAILED: 70,
});

export const HIN_ANCHOR_RANK = Object.freeze({
  CREATED: 1,
  INTENT_CREATED: 5,
  QUEUED: 10,
  SUBMITTED: 20,
  ACCEPTED: 30,
  PENDING_FINALITY: 40,
  UNKNOWN: 25,
  FINALIZED: 80,
  REJECTED: 70,
  FAILED: 75,
  REORG_OBSERVED: 60,
});

export function paymentDomainTransition(
  current: keyof typeof PAYMENT_STATUS_RANK,
  incoming: keyof typeof PAYMENT_STATUS_RANK,
): ReturnType<DomainTransitionFn<keyof typeof PAYMENT_STATUS_RANK>> {
  return applyMonotonicState(current, incoming, PAYMENT_STATUS_RANK);
}

export function custodyDomainTransition(
  current: keyof typeof CUSTODY_STATUS_RANK,
  incoming: keyof typeof CUSTODY_STATUS_RANK,
): ReturnType<DomainTransitionFn<keyof typeof CUSTODY_STATUS_RANK>> {
  return applyMonotonicState(current, incoming, CUSTODY_STATUS_RANK);
}

export function exchangeDomainTransition(
  current: keyof typeof EXCHANGE_SETTLEMENT_RANK,
  incoming: keyof typeof EXCHANGE_SETTLEMENT_RANK,
): ReturnType<DomainTransitionFn<keyof typeof EXCHANGE_SETTLEMENT_RANK>> {
  return applyMonotonicState(current, incoming, EXCHANGE_SETTLEMENT_RANK);
}

export function hinAnchorDomainTransition(
  current: keyof typeof HIN_ANCHOR_RANK,
  incoming: keyof typeof HIN_ANCHOR_RANK,
): ReturnType<DomainTransitionFn<keyof typeof HIN_ANCHOR_RANK>> {
  return applyMonotonicState(current, incoming, HIN_ANCHOR_RANK);
}

export function oracleObservationKey(input: {
  readonly providerId: string;
  readonly sourceId: string;
  readonly feedId: string;
  readonly sourceObservationId: string;
}): string {
  return [input.providerId, input.sourceId, input.feedId, input.sourceObservationId].join('::');
}

export class OracleObservationDedupe {
  private readonly seen = new Set<string>();

  admit(input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly feedId: string;
    readonly sourceObservationId: string;
  }): 'accepted' | 'duplicate' {
    const key = oracleObservationKey(input);
    if (this.seen.has(key)) {
      return 'duplicate';
    }
    this.seen.add(key);
    return 'accepted';
  }
}

export type ApprovalBindingFields = {
  readonly destination: string;
  readonly assetId: string;
  readonly quantityMinor: string;
  readonly feePolicyId: string;
  readonly network: string;
  readonly canonicalSemantics: string;
};

export function approvalBindingUnchanged(
  approved: ApprovalBindingFields,
  retry: ApprovalBindingFields,
): boolean {
  return (
    approved.destination === retry.destination &&
    approved.assetId === retry.assetId &&
    approved.quantityMinor === retry.quantityMinor &&
    approved.feePolicyId === retry.feePolicyId &&
    approved.network === retry.network &&
    approved.canonicalSemantics === retry.canonicalSemantics
  );
}
