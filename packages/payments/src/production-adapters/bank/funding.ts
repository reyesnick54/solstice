/**
 * Funding adapters. Every inbound credit is a verified notice, not an
 * automatic Ledger posting. Approved financial workflows remain:
 * Kernel → Execution Authority → Ledger.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { Money } from '../../../../money/src/money.ts';
import type { AdapterResult } from '../types.ts';
import { adapterErr, adapterOk } from '../types.ts';

export const FUNDING_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export type FundingDirection = (typeof FUNDING_DIRECTIONS)[number];

export const FUNDING_NOTICE_STATUSES = [
  'RECEIVED',
  'AUTHENTICATED',
  'MAPPED',
  'AWAITING_AUTHORIZATION',
  'REJECTED',
  'REQUIRES_RECONCILIATION',
] as const;
export type FundingNoticeStatus = (typeof FUNDING_NOTICE_STATUSES)[number];

export type FundingNotice = {
  readonly noticeId: string;
  readonly providerId: string;
  readonly externalAccountId: string;
  readonly sunreyAccountId: string | null;
  readonly direction: FundingDirection;
  readonly amount: Money;
  readonly providerReference: string;
  readonly receivedAt: UtcInstant;
  readonly status: FundingNoticeStatus;
  readonly authenticated: boolean;
  readonly mapped: boolean;
  readonly automaticLedgerCredit: false;
};

export type FundingRequest = {
  readonly noticeId: string;
  readonly providerId: string;
  readonly externalAccountId: string;
  readonly sunreyAccountId?: string;
  readonly amount: Money;
  readonly providerReference: string;
  readonly receivedAt: UtcInstant;
  readonly authenticated: boolean;
};

export type FundingAdapter = {
  notifyDeposit(request: FundingRequest): AdapterResult<FundingNotice>;
  inboundBankTransfer(request: FundingRequest): AdapterResult<FundingNotice>;
  outboundBankTransfer(request: FundingRequest): AdapterResult<FundingNotice>;
  fundAccount(request: FundingRequest): AdapterResult<FundingNotice>;
  withdrawAccount(request: FundingRequest): AdapterResult<FundingNotice>;
};

export function freezeFundingNotice(notice: FundingNotice): FundingNotice {
  return Object.freeze({ ...notice, automaticLedgerCredit: false });
}

export function inboundRequiresApprovedWorkflow(notice: FundingNotice): {
  readonly creditCustomer: false;
  readonly reason: string;
} {
  if (!notice.authenticated || !notice.mapped || notice.status !== 'AWAITING_AUTHORIZATION') {
    return {
      creditCustomer: false,
      reason: 'inbound_requires_authenticity_mapping_and_execution_authority',
    };
  }
  return {
    creditCustomer: false,
    reason: 'inbound_still_requires_kernel_gated_ledger_posting',
  };
}

export class SimulatedFundingAdapter implements FundingAdapter {
  notifyDeposit(request: FundingRequest): AdapterResult<FundingNotice> {
    return this.notice(request, 'INBOUND');
  }

  inboundBankTransfer(request: FundingRequest): AdapterResult<FundingNotice> {
    return this.notice(request, 'INBOUND');
  }

  outboundBankTransfer(request: FundingRequest): AdapterResult<FundingNotice> {
    return this.notice(request, 'OUTBOUND');
  }

  fundAccount(request: FundingRequest): AdapterResult<FundingNotice> {
    return this.notice(request, 'INBOUND');
  }

  withdrawAccount(request: FundingRequest): AdapterResult<FundingNotice> {
    return this.notice(request, 'OUTBOUND');
  }

  private notice(request: FundingRequest, direction: FundingDirection): AdapterResult<FundingNotice> {
    if (!request.authenticated) {
      return adapterErr('FUNDING_UNAUTHENTICATED', 'funding notice must be authenticated', {
        submissionCertainty: 'DEFINITELY_NOT_SUBMITTED',
      });
    }
    const mapped = Boolean(request.sunreyAccountId);
    return adapterOk(
      freezeFundingNotice({
        noticeId: request.noticeId,
        providerId: request.providerId,
        externalAccountId: request.externalAccountId,
        sunreyAccountId: request.sunreyAccountId ?? null,
        direction,
        amount: request.amount,
        providerReference: request.providerReference,
        receivedAt: request.receivedAt,
        status: mapped ? 'AWAITING_AUTHORIZATION' : 'MAPPED',
        authenticated: true,
        mapped,
        automaticLedgerCredit: false,
      }),
    );
  }
}
