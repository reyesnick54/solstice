import { Money } from '../../../contracts/src/money.ts';
import type {
  ContextAccount,
  ContextTransaction,
  FinancialContextSnapshot,
  HighCostDebt,
  NearTermObligation,
  RecurringPattern,
  UserGoal,
} from '../../../contracts/src/financial-context.ts';
import type { DataCategory } from '../../../contracts/src/proposal-types.ts';
import type { ProductAccountClass } from '../../../contracts/src/account-class.ts';
import { PRODUCT_ACCOUNT_CLASSES } from '../../../contracts/src/account-class.ts';
import type { CustomerId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';

export type RawFinancialFacts = {
  readonly customerId: CustomerId;
  readonly asOf: UtcInstant;
  readonly currency: string;
  readonly accounts: readonly ContextAccount[];
  readonly recentTransactions: readonly ContextTransaction[];
  readonly recurringPatterns: readonly RecurringPattern[];
  readonly monthlyEssentialSpending: Money;
  readonly highCostDebt: readonly HighCostDebt[];
  readonly nearTermObligations: readonly NearTermObligation[];
  readonly userGoals: readonly UserGoal[];
  readonly realizedGainsThisWeek: Money;
  readonly piiFullName?: string;
  readonly taxId?: string;
};

const CATEGORY_TO_STRIP: { readonly [C in DataCategory]?: keyof RawFinancialFacts } = {
  PII_FULL_NAME: 'piiFullName',
  TAX_ID: 'taxId',
};

/**
 * Assembles an authorized read-only snapshot. Forbidden data categories
 * on the capability token are stripped here — the agent never sees them.
 * There is no write method on the result.
 */
export function assembleFinancialContext(
  raw: RawFinancialFacts,
  claims: CapabilityTokenClaims,
): FinancialContextSnapshot {
  const stripped: DataCategory[] = [...claims.forbiddenDataCategories];

  if (claims.forbiddenDataCategories.includes('TRANSACTIONS')) {
    stripped.push('TRANSACTIONS');
  }
  if (claims.forbiddenDataCategories.includes('RECURRING_PATTERNS')) {
    stripped.push('RECURRING_PATTERNS');
  }
  if (claims.forbiddenDataCategories.includes('BALANCES')) {
    stripped.push('BALANCES');
  }

  const transactions = claims.forbiddenDataCategories.includes('TRANSACTIONS')
    ? []
    : raw.recentTransactions;
  const patterns = claims.forbiddenDataCategories.includes('RECURRING_PATTERNS')
    ? []
    : raw.recurringPatterns;

  const balancesByClass = {} as { [C in ProductAccountClass]: Money };
  for (const cls of PRODUCT_ACCOUNT_CLASSES) {
    if (claims.forbiddenDataCategories.includes('BALANCES')) {
      balancesByClass[cls] = Money.zero(raw.currency);
      continue;
    }
    const sum = raw.accounts
      .filter((a) => a.accountClass === cls)
      .reduce((acc, a) => acc.plus(a.balance), Money.zero(raw.currency));
    balancesByClass[cls] = sum;
  }

  const snapshot: FinancialContextSnapshot = {
    customerId: raw.customerId,
    asOf: raw.asOf,
    currency: raw.currency,
    accounts: Object.freeze(
      claims.forbiddenDataCategories.includes('ACCOUNT_CLASSES')
        ? []
        : raw.accounts.map((a) => Object.freeze({ ...a })),
    ),
    balancesByClass: Object.freeze(balancesByClass),
    recentTransactions: Object.freeze([...transactions]),
    recurringPatterns: Object.freeze([...patterns]),
    monthlyEssentialSpending: raw.monthlyEssentialSpending,
    highCostDebt: Object.freeze([...raw.highCostDebt]),
    nearTermObligations: Object.freeze([...raw.nearTermObligations]),
    userGoals: Object.freeze([...raw.userGoals]),
    realizedGainsThisWeek: raw.realizedGainsThisWeek,
    strippedDataCategories: Object.freeze([...new Set(stripped)]),
    writePath: false,
  };

  // Forbidden PII/tax fields are intentionally not copied onto the snapshot.
  void CATEGORY_TO_STRIP;
  void raw.piiFullName;
  void raw.taxId;

  return Object.freeze(snapshot);
}

export function snapshotHasForbiddenField(
  snapshot: FinancialContextSnapshot,
  field: 'piiFullName' | 'taxId' | 'authenticationSecrets' | 'rawCardPan',
): boolean {
  return field in snapshot;
}
