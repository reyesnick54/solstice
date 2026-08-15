import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { TreasuryAccountId } from './ids.ts';
import type { TreasuryAccountKind, TreasuryOwnership } from './types.ts';

/**
 * Typed treasury book metadata. This is not a customer Account and is not
 * a second ledger. Customer balances remain in the canonical banking ledger.
 */
export type TreasuryAccount = {
  readonly treasuryAccountId: TreasuryAccountId;
  readonly name: string;
  readonly kind: TreasuryAccountKind;
  readonly ownership: TreasuryOwnership;
  readonly legalEntityId: LegalEntityId;
  readonly currency: CurrencyCode;
  readonly country: string;
  readonly provider: string;
  readonly rail: string;
  readonly corridorId: string | null;
  readonly ledgerAccountId: string | null;
  readonly cardSettlementRef: string | null;
};

export type LiquidityAddress = {
  readonly legalEntityId: string;
  readonly currency: string;
  readonly country: string;
  readonly corridorId: string | null;
  readonly provider: string;
  readonly rail: string;
  readonly treasuryAccountId: string;
};

export function liquidityAddressOf(account: TreasuryAccount): LiquidityAddress {
  return Object.freeze({
    legalEntityId: account.legalEntityId,
    currency: account.currency,
    country: account.country,
    corridorId: account.corridorId,
    provider: account.provider,
    rail: account.rail,
    treasuryAccountId: account.treasuryAccountId,
  });
}

export function assertNonCustomerOwnership(ownership: TreasuryOwnership): void {
  if (ownership === 'CUSTOMER') {
    throw new Error('treasury books must not use CUSTOMER ownership; customer balances stay on the banking ledger');
  }
}

export function freezeTreasuryAccount(input: TreasuryAccount): TreasuryAccount {
  assertNonCustomerOwnership(input.ownership);
  if (input.kind === 'CARD_SETTLEMENT_REF' && !input.cardSettlementRef) {
    throw new Error('card settlement reference books require cardSettlementRef');
  }
  return Object.freeze({ ...input });
}
