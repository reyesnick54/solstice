import type { Account } from '../../../packages/domain/src/account.ts';
import type { AccountRestrictionCode } from '../../../packages/domain/src/account-restriction.ts';
import { err, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { RestrictionStore } from './restriction-store.ts';

export type RestrictionBlock = {
  readonly code: 'ACCOUNT_RESTRICTED';
  readonly restriction: AccountRestrictionCode;
  readonly message: string;
};

export type MovementKind = 'DEPOSIT' | 'WITHDRAWAL' | 'INTERNAL_TRANSFER' | 'HOLD' | 'CARD' | 'TRADING';

const MOVEMENT_CODES: { readonly [K in MovementKind]: readonly AccountRestrictionCode[] } = {
  DEPOSIT: ['CREDIT_BLOCKED', 'COMPLIANCE_REVIEW'],
  WITHDRAWAL: ['DEBIT_BLOCKED', 'WITHDRAWAL_BLOCKED', 'COMPLIANCE_REVIEW'],
  INTERNAL_TRANSFER: ['DEBIT_BLOCKED', 'TRANSFER_BLOCKED', 'COMPLIANCE_REVIEW'],
  HOLD: ['DEBIT_BLOCKED', 'WITHDRAWAL_BLOCKED', 'COMPLIANCE_REVIEW'],
  CARD: ['CARD_BLOCKED', 'DEBIT_BLOCKED', 'COMPLIANCE_REVIEW'],
  TRADING: ['TRADING_BLOCKED', 'COMPLIANCE_REVIEW'],
};

export function assertMovementAllowed(
  restrictions: RestrictionStore,
  account: Account | undefined,
  kind: MovementKind,
  destination?: Account,
): Result<true, RestrictionBlock> {
  if (!account) {
    return ok(true);
  }
  if (account.status === 'FROZEN' || account.status === 'CLOSED' || account.status === 'PENDING_OPEN') {
    return err({
      code: 'ACCOUNT_RESTRICTED',
      restriction: 'COMPLIANCE_REVIEW',
      message: `${account.status} account cannot move funds`,
    });
  }
  const blocked = firstActive(restrictions, account.id, MOVEMENT_CODES[kind]);
  if (blocked) {
    return err({
      code: 'ACCOUNT_RESTRICTED',
      restriction: blocked,
      message: `${blocked} prevents ${kind.toLowerCase()} on ${account.id}`,
    });
  }
  if (destination) {
    if (destination.status === 'FROZEN' || destination.status === 'CLOSED') {
      return err({
        code: 'ACCOUNT_RESTRICTED',
        restriction: 'CREDIT_BLOCKED',
        message: `${destination.status} destination cannot receive funds`,
      });
    }
    const creditBlocked = firstActive(restrictions, destination.id, ['CREDIT_BLOCKED', 'COMPLIANCE_REVIEW']);
    if (creditBlocked) {
      return err({
        code: 'ACCOUNT_RESTRICTED',
        restriction: creditBlocked,
        message: `${creditBlocked} prevents credit to ${destination.id}`,
      });
    }
  }
  return ok(true);
}

function firstActive(
  restrictions: RestrictionStore,
  accountId: string,
  codes: readonly AccountRestrictionCode[],
): AccountRestrictionCode | null {
  for (const code of codes) {
    if (restrictions.hasActive(accountId, code)) {
      return code;
    }
  }
  return null;
}
