/**
 * Canonical linkage between a SunRey account, Ledger books, and an
 * external provider account. Provider balance is not customer Ledger
 * authority.
 */

import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export const LINKAGE_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'RESTRICTED',
  'CLOSED',
  'REQUIRES_RECONCILIATION',
] as const;
export type LinkageStatus = (typeof LINKAGE_STATUSES)[number];

export type LinkageReconciliationMetadata = {
  readonly lastStatementRef: string | null;
  readonly lastTransactionCursor: string | null;
  readonly lastReconciledAt: UtcInstant | null;
  readonly outstandingBreakCount: number;
};

export type ExternalAccountLinkage = {
  readonly linkageId: string;
  readonly sunreyAccountId: string;
  readonly ledgerAccountId: string;
  readonly providerId: string;
  readonly externalAccountId: string;
  readonly currency: CurrencyCode;
  readonly jurisdiction: string;
  readonly status: LinkageStatus;
  readonly createdAt: UtcInstant;
  readonly lastVerifiedAt: UtcInstant | null;
  readonly reconciliation: LinkageReconciliationMetadata;
  readonly providerBalanceIsLedgerAuthority: false;
};

export function freezeExternalAccountLinkage(input: ExternalAccountLinkage): ExternalAccountLinkage {
  if (input.providerBalanceIsLedgerAuthority) {
    throw new TypeError('provider balance must not be treated as Ledger authority');
  }
  return Object.freeze({
    ...input,
    reconciliation: Object.freeze({ ...input.reconciliation }),
    providerBalanceIsLedgerAuthority: false,
  });
}

export class ExternalAccountLinkageRegistry {
  private readonly rows = new Map<string, ExternalAccountLinkage>();

  register(linkage: ExternalAccountLinkage): ExternalAccountLinkage {
    const frozen = freezeExternalAccountLinkage(linkage);
    this.rows.set(frozen.linkageId, frozen);
    return frozen;
  }

  get(linkageId: string): ExternalAccountLinkage | undefined {
    return this.rows.get(linkageId);
  }

  findBySunreyAccount(sunreyAccountId: string): readonly ExternalAccountLinkage[] {
    return Object.freeze([...this.rows.values()].filter((row) => row.sunreyAccountId === sunreyAccountId));
  }

  findByExternal(providerId: string, externalAccountId: string): ExternalAccountLinkage | undefined {
    return [...this.rows.values()].find(
      (row) => row.providerId === providerId && row.externalAccountId === externalAccountId,
    );
  }

  markVerified(linkageId: string, at: UtcInstant): ExternalAccountLinkage | undefined {
    const existing = this.rows.get(linkageId);
    if (!existing) {
      return undefined;
    }
    const next = freezeExternalAccountLinkage({
      ...existing,
      lastVerifiedAt: at,
      status: existing.status === 'PENDING_VERIFICATION' ? 'ACTIVE' : existing.status,
    });
    this.rows.set(linkageId, next);
    return next;
  }
}
