import { canTransitionAccountStatus, type Account, type AccountStatus } from '../../../packages/domain/src/account.ts';
import { err, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { FinancialAccountLifecycle } from './product-account.ts';

export type IllegalFinancialLifecycle = {
  readonly code: 'ILLEGAL_FINANCIAL_LIFECYCLE';
  readonly from: FinancialAccountLifecycle;
  readonly to: FinancialAccountLifecycle;
  readonly message: string;
};

/**
 * Server-controlled product lifecycle. A frontend cannot declare ACTIVE.
 * Domain status changes are applied only when the target maps to a legal
 * AccountStatus transition.
 */
const ALLOWED: { readonly [S in FinancialAccountLifecycle]: readonly FinancialAccountLifecycle[] } = {
  PENDING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['RESTRICTED', 'FROZEN', 'CLOSING', 'CLOSED'],
  RESTRICTED: ['ACTIVE', 'FROZEN', 'CLOSING', 'CLOSED'],
  FROZEN: ['ACTIVE', 'RESTRICTED', 'CLOSING', 'CLOSED'],
  CLOSING: ['CLOSED', 'ACTIVE'],
  CLOSED: [],
};

export function canTransitionFinancialLifecycle(
  from: FinancialAccountLifecycle,
  to: FinancialAccountLifecycle,
): boolean {
  return ALLOWED[from].includes(to);
}

export function domainStatusForLifecycle(lifecycle: FinancialAccountLifecycle): AccountStatus | null {
  switch (lifecycle) {
    case 'PENDING':
      return 'PENDING_OPEN';
    case 'ACTIVE':
    case 'RESTRICTED':
    case 'CLOSING':
      return 'OPEN';
    case 'FROZEN':
      return 'FROZEN';
    case 'CLOSED':
      return 'CLOSED';
  }
}

export function assertLifecycleTransition(
  from: FinancialAccountLifecycle,
  to: FinancialAccountLifecycle,
  account: Account,
): Result<AccountStatus | null, IllegalFinancialLifecycle> {
  if (!canTransitionFinancialLifecycle(from, to)) {
    return err({
      code: 'ILLEGAL_FINANCIAL_LIFECYCLE',
      from,
      to,
      message: `lifecycle ${from} cannot move to ${to}`,
    });
  }
  const target = domainStatusForLifecycle(to);
  if (target === null || target === account.status) {
    return ok(null);
  }
  if (!canTransitionAccountStatus(account.status, target)) {
    return err({
      code: 'ILLEGAL_FINANCIAL_LIFECYCLE',
      from,
      to,
      message: `domain status ${account.status} cannot move to ${target} for lifecycle ${to}`,
    });
  }
  return ok(target);
}
