import type { Account } from "./account.ts";
import type { AccountClass, ClassificationTag } from "./account-class.ts";
import { ACCOUNT_CLASSES, classificationFor } from "./account-class.ts";
import type { CustomerId } from "./account.ts";
import type { PostingQuery } from "./ledger.ts";
import {
  applyFxConversion,
  Money,
  type CurrencyCode,
  type FxConversion,
} from "./money.ts";
import { err, ok, type Result } from "./result.ts";

/**
 * Typed error returned instead of a wrong number when mixed currencies
 * would be summed without an explicit conversion (rate + timestamp).
 */
export type MixedCurrencyWithoutConversion = {
  readonly type: "MixedCurrencyWithoutConversion";
  readonly currencies: readonly CurrencyCode[];
  readonly message: string;
};

export type PositionError = MixedCurrencyWithoutConversion;

export type ClassifiedClassTotal<C extends AccountClass = AccountClass> = {
  readonly accountClass: C;
  readonly classification: ClassificationTag<C>;
  readonly total: Money;
};

export type PositionBreakdown = {
  readonly [C in AccountClass]: ClassifiedClassTotal<C>;
};

/**
 * Customer position — the only way to obtain a grand total ("Total Solstice
 * Wealth"). The total is not a bare number and cannot be constructed or
 * returned without the per-class breakdown sitting beside it.
 *
 * Converting the total into a percentage investment return is architecturally
 * forbidden. This type exposes no yield, APY, APR, growth-rate, or
 * percentage-return field, and none may be added.
 */
const ASSEMBLE_KEY: unique symbol = Symbol("CustomerPosition.assemble");

export class CustomerPosition {
  readonly #brand = "CustomerPosition" as const;

  private constructor(
    readonly customerId: CustomerId,
    readonly breakdown: PositionBreakdown,
    readonly grandTotal: Money,
    key: typeof ASSEMBLE_KEY,
  ) {
    if (key !== ASSEMBLE_KEY) {
      throw new Error(
        "CustomerPosition cannot be constructed as a bare total; use assemble() so the grand total always accompanies the per-class breakdown",
      );
    }
    Object.freeze(this.breakdown);
    Object.freeze(this);
  }

  /**
   * Assemble a position from per-class totals. The grand total is derived
   * here from the breakdown (with FX only when an explicit conversion is
   * supplied) so a blended figure never exists without its class split.
   */
  static assemble(
    customerId: CustomerId,
    breakdown: PositionBreakdown,
    conversion?: FxConversion | readonly FxConversion[],
  ): Result<CustomerPosition, PositionError> {
    const classTotals = ACCOUNT_CLASSES.map(
      (accountClass) => breakdown[accountClass].total,
    );
    const summed = sumMonies(classTotals, conversion);
    if (!summed.ok) {
      return summed;
    }
    return ok(
      new CustomerPosition(customerId, breakdown, summed.value, ASSEMBLE_KEY),
    );
  }

  /** Present so the private brand participates in the public shape. */
  get [Symbol.toStringTag](): string {
    return this.#brand;
  }
}

/**
 * Balance of a single account: the sum of that account's ledger postings.
 * Returns the Money primitive only (via Result). Never reads a stored
 * balance — Account has none.
 */
export function balanceOfAccount(
  query: PostingQuery,
  account: Account,
): Result<Money, PositionError> {
  const postings = query.listByAccount(account.id);
  if (postings.length === 0) {
    return ok(Money.zero(account.currency));
  }

  const amounts: Money[] = [Money.zero(account.currency)];
  for (const posting of postings) {
    amounts.push(posting.amount);
  }
  return sumMonies(amounts);
}

export type ProjectCustomerPositionInput = {
  readonly query: PostingQuery;
  readonly customerId: CustomerId;
  readonly accounts: readonly Account[];
  readonly homeCurrency: CurrencyCode;
  readonly conversion?: FxConversion | readonly FxConversion[];
};

/**
 * Read-only customer position projection. Walks accounts, sums each
 * account's postings, groups by account class, and returns class totals
 * plus a grand total in one object. Does not write to the ledger.
 */
export function projectCustomerPosition(
  input: ProjectCustomerPositionInput,
): Result<CustomerPosition, PositionError> {
  const { query, customerId, homeCurrency, conversion } = input;
  const owned = input.accounts.filter(
    (account) => account.customerId === customerId,
  );

  const deposits = classifiedSum("deposits", query, owned, homeCurrency, conversion);
  if (!deposits.ok) return deposits;
  const investments = classifiedSum(
    "investments",
    query,
    owned,
    homeCurrency,
    conversion,
  );
  if (!investments.ok) return investments;
  const digitalAssets = classifiedSum(
    "digital_assets",
    query,
    owned,
    homeCurrency,
    conversion,
  );
  if (!digitalAssets.ok) return digitalAssets;
  const rewards = classifiedSum("rewards", query, owned, homeCurrency, conversion);
  if (!rewards.ok) return rewards;
  const pending = classifiedSum("pending", query, owned, homeCurrency, conversion);
  if (!pending.ok) return pending;

  return CustomerPosition.assemble(
    customerId,
    {
      deposits: deposits.value,
      investments: investments.value,
      digital_assets: digitalAssets.value,
      rewards: rewards.value,
      pending: pending.value,
    },
    conversion,
  );
}

function classifiedSum<C extends AccountClass>(
  accountClass: C,
  query: PostingQuery,
  owned: readonly Account[],
  homeCurrency: CurrencyCode,
  conversion: FxConversion | readonly FxConversion[] | undefined,
): Result<ClassifiedClassTotal<C>, PositionError> {
  const classSum = sumAccountsInClass(
    query,
    owned.filter((account) => account.accountClass === accountClass),
    homeCurrency,
    conversion,
  );
  if (!classSum.ok) {
    return classSum;
  }
  return ok({
    accountClass,
    classification: classificationFor(accountClass),
    total: classSum.value,
  });
}

function sumAccountsInClass(
  query: PostingQuery,
  accounts: readonly Account[],
  homeCurrency: CurrencyCode,
  conversion: FxConversion | readonly FxConversion[] | undefined,
): Result<Money, PositionError> {
  if (accounts.length === 0) {
    return ok(Money.zero(homeCurrency));
  }

  const amounts: Money[] = [];
  for (const account of accounts) {
    const balance = balanceOfAccount(query, account);
    if (!balance.ok) {
      return balance;
    }
    amounts.push(balance.value);
  }
  return sumMonies(amounts, conversion, homeCurrency);
}

/**
 * Sum Money values. Same-currency values are added as bigint minor units.
 * Mixed non-zero currencies require an explicit conversion (rate + timestamp);
 * otherwise a typed MixedCurrencyWithoutConversion error is returned.
 *
 * Zero amounts do not introduce a currency into the mix: 0 EUR beside
 * 100 USD does not force FX, and is not added into the USD figure.
 */
function sumMonies(
  amounts: readonly Money[],
  conversion?: FxConversion | readonly FxConversion[],
  emptyCurrency?: CurrencyCode,
): Result<Money, PositionError> {
  const nonZero = amounts.filter((amount) => !amount.isZero);

  if (nonZero.length === 0) {
    const currency = amounts[0]?.currency ?? emptyCurrency;
    if (currency === undefined) {
      throw new Error("sumMonies requires a currency when all amounts are empty");
    }
    return ok(Money.zero(currency));
  }

  const currencies = uniqueCurrencies(nonZero);

  if (currencies.length === 1) {
    const currency = currencies[0]!;
    let total = Money.zero(currency);
    for (const amount of nonZero) {
      total = total.add(amount);
    }
    return ok(total);
  }

  const conversions = normalizeConversions(conversion);
  if (conversions.length === 0) {
    return err(mixedCurrencyError(currencies, "no FX conversion was supplied"));
  }

  const target = sharedTarget(conversions);
  if (target === undefined) {
    return err(
      mixedCurrencyError(
        currencies,
        "explicit conversions must share a single target currency",
      ),
    );
  }

  if (!conversionsHaveTimestamps(conversions)) {
    return err(
      mixedCurrencyError(
        currencies,
        "every FX conversion must carry a timestamp",
      ),
    );
  }

  let total = Money.zero(target);
  for (const amount of nonZero) {
    const converted = convertToTarget(amount, target, conversions);
    if (!converted.ok) {
      return converted;
    }
    total = total.add(converted.value);
  }
  return ok(total);
}

function convertToTarget(
  amount: Money,
  target: CurrencyCode,
  conversions: readonly FxConversion[],
): Result<Money, PositionError> {
  if (amount.currency === target) {
    return ok(amount);
  }
  const match = conversions.find(
    (fx) => fx.from === amount.currency && fx.to === target,
  );
  if (match === undefined) {
    return err(
      mixedCurrencyError(
        [amount.currency, target],
        `no FX conversion supplied for ${amount.currency}→${target}`,
      ),
    );
  }
  return ok(applyFxConversion(amount, match));
}

function normalizeConversions(
  conversion: FxConversion | readonly FxConversion[] | undefined,
): readonly FxConversion[] {
  if (conversion === undefined) {
    return [];
  }
  return ([] as FxConversion[]).concat(conversion);
}

function sharedTarget(
  conversions: readonly FxConversion[],
): CurrencyCode | undefined {
  const targets = new Set(conversions.map((fx) => fx.to));
  if (targets.size !== 1) {
    return undefined;
  }
  return conversions[0]?.to;
}

function conversionsHaveTimestamps(
  conversions: readonly FxConversion[],
): boolean {
  return conversions.every(
    (fx) => fx.timestamp instanceof Date && !Number.isNaN(fx.timestamp.getTime()),
  );
}

function uniqueCurrencies(amounts: readonly Money[]): CurrencyCode[] {
  return [...new Set(amounts.map((amount) => amount.currency))];
}

function mixedCurrencyError(
  currencies: readonly CurrencyCode[],
  detail: string,
): MixedCurrencyWithoutConversion {
  const listed = [...new Set(currencies)].sort().join(", ");
  return {
    type: "MixedCurrencyWithoutConversion",
    currencies: [...new Set(currencies)].sort(),
    message: `Cannot sum mixed currencies (${listed}) into one figure without an explicit conversion carrying its rate and timestamp: ${detail}`,
  };
}

export type ForbiddenReturnMetricKeys =
  | "percentageReturn"
  | "percentReturn"
  | "yield"
  | "apy"
  | "apr"
  | "growthRate"
  | "returnRate"
  | "blendedYield"
  | "rateOfReturn";

/**
 * Type-level lock: adding any return-metric field to CustomerPosition
 * makes this alias `false` and fails the compile-time test.
 */
export type CustomerPositionHasNoReturnMetrics =
  Extract<keyof CustomerPosition, ForbiddenReturnMetricKeys> extends never
    ? true
    : false;
