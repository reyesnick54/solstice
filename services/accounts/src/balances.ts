import type { Account } from '../../../packages/domain/src/account.ts';
import {
  ACCOUNT_CLASS_CATALOG,
  type InsuranceClassification,
  type PositionBucket,
  type RealizationClassification,
} from '../../../packages/domain/src/account-class.ts';
import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import { err, isErr, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
import { asMoney, ledgerAssetKey } from '../../../packages/money/src/ledger-amount.ts';
import { applyFxConversion, Money, type FxConversion } from '../../../packages/money/src/money.ts';

export type MixedCurrencyWithoutConversion = {
  readonly code: 'MIXED_CURRENCY_WITHOUT_CONVERSION';
  readonly currencies: readonly string[];
  readonly message: string;
};

export type ClassifiedClassTotal<B extends PositionBucket = PositionBucket> = {
  readonly accountClass: B;
  readonly classification: {
    readonly accountClass: B;
    readonly insurance: InsuranceClassification;
    readonly realization: RealizationClassification;
  };
  readonly total: Money;
};

export type PositionBreakdown = {
  readonly deposits: ClassifiedClassTotal<'deposits'>;
  readonly investments: ClassifiedClassTotal<'investments'>;
  readonly digital_assets: ClassifiedClassTotal<'digital_assets'>;
  readonly rewards: ClassifiedClassTotal<'rewards'>;
  readonly pending: ClassifiedClassTotal<'pending'>;
};

const BUCKET_CLASSIFICATION: {
  readonly [B in PositionBucket]: {
    readonly insurance: InsuranceClassification;
    readonly realization: RealizationClassification;
  };
} = {
  deposits: { insurance: 'insured', realization: 'realized' },
  investments: { insurance: 'at_risk', realization: 'realized' },
  digital_assets: { insurance: 'at_risk', realization: 'realized' },
  rewards: { insurance: 'at_risk', realization: 'realized' },
  pending: { insurance: 'at_risk', realization: 'pending' },
};

/**
 * Per-customer position. Grand total exists only as a field on this object,
 * which always includes the per-class breakdown. There is no function that
 * returns a customer-wide Money by itself, so a bare blended number cannot
 * be returned without its breakdown.
 *
 * Converting the total into a percentage investment return is architecturally
 * forbidden. This type exposes no yield, APY, growth-rate, or percentage-return
 * field. Do not add one.
 */
export class CustomerPosition {
  readonly customerId: CustomerId;
  readonly breakdown: PositionBreakdown;
  readonly grandTotal: Money;

  private constructor(
    customerId: CustomerId,
    breakdown: PositionBreakdown,
    grandTotal: Money,
  ) {
    this.customerId = customerId;
    this.breakdown = breakdown;
    this.grandTotal = grandTotal;
    Object.freeze(this);
    Object.freeze(this.breakdown);
  }

  static assemble(
    customerId: CustomerId,
    breakdown: PositionBreakdown,
  ): CustomerPosition {
    const grandTotal = breakdown.deposits.total
      .plus(breakdown.investments.total)
      .plus(breakdown.digital_assets.total)
      .plus(breakdown.rewards.total)
      .plus(breakdown.pending.total);
    return new CustomerPosition(customerId, breakdown, grandTotal);
  }
}

/**
 * Per-account balance summed from ledger postings.
 * Customer-funded accounts are credit-normal: balance = credits − debits.
 */
export function balanceOfAccount(
  ledger: Ledger,
  account: Account,
): Result<Money, MixedCurrencyWithoutConversion> {
  const postings = ledger.listPostingsForAccount(account.id);
  let credits = Money.zero(account.currency);
  let debits = Money.zero(account.currency);
  const currencies = new Set<string>([account.currency]);
  for (const posting of postings) {
    currencies.add(ledgerAssetKey(posting.amount));
    if (ledgerAssetKey(posting.amount) !== account.currency) {
      return err({
        code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
        currencies: [...currencies],
        message: 'account postings span currencies; supply an explicit FX conversion',
      });
    }
    if (posting.direction === 'CREDIT') {
      credits = credits.plus(asMoney(posting.amount));
    } else {
      debits = debits.plus(asMoney(posting.amount));
    }
  }
  return ok(credits.minus(debits));
}

export function projectCustomerPosition(
  ledger: Ledger,
  customerId: CustomerId,
  accounts: readonly Account[],
  conversions: readonly FxConversion[] = [],
): Result<CustomerPosition, MixedCurrencyWithoutConversion> {
  const owned = accounts.filter((account) => account.ownerId === customerId);
  const currencies = new Set(owned.map((account) => account.currency));
  const target = owned[0]?.currency ?? 'USD';

  if (currencies.size > 1 && conversions.length === 0) {
    return err({
      code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
      currencies: [...currencies],
      message:
        'mixed currencies with no rate supplied; refusing to return a wrong number',
    });
  }

  const bucketTotals: { [B in PositionBucket]: Money } = {
    deposits: Money.zero(target),
    investments: Money.zero(target),
    digital_assets: Money.zero(target),
    rewards: Money.zero(target),
    pending: Money.zero(target),
  };

  for (const account of owned) {
    const record = ACCOUNT_CLASS_CATALOG[account.accountClass];
    if (record.positionBucket === null) {
      continue;
    }
    const raw = balanceOfAccount(ledger, account);
    if (isErr(raw)) {
      return raw;
    }
    let amount = raw.value;
    if (amount.currency !== target) {
      const conversion = conversions.find(
        (c) => c.from === amount.currency && c.to === target,
      );
      if (!conversion) {
        return err({
          code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
          currencies: [...currencies],
          message: `no FX conversion supplied for ${amount.currency} → ${target}`,
        });
      }
      amount = applyFxConversion(amount, conversion);
    }
    const bucket = record.positionBucket;
    bucketTotals[bucket] = bucketTotals[bucket].plus(amount);
  }

  const breakdown: PositionBreakdown = {
    deposits: classified('deposits', bucketTotals.deposits),
    investments: classified('investments', bucketTotals.investments),
    digital_assets: classified('digital_assets', bucketTotals.digital_assets),
    rewards: classified('rewards', bucketTotals.rewards),
    pending: classified('pending', bucketTotals.pending),
  };

  return ok(CustomerPosition.assemble(customerId, breakdown));
}

/**
 * Currency-indexed customer position. Each currency is a separate
 * CustomerPosition. There is no blended grand total on this object.
 */
export type CurrencyIndexedCustomerPosition = {
  readonly customerId: CustomerId;
  readonly currencies: readonly string[];
  readonly byCurrency: Readonly<Record<string, CustomerPosition>>;
};

export function projectCurrencyIndexedPosition(
  ledger: Ledger,
  customerId: CustomerId,
  accounts: readonly Account[],
): Result<CurrencyIndexedCustomerPosition, MixedCurrencyWithoutConversion> {
  const owned = accounts.filter((account) => account.ownerId === customerId);
  const grouped = new Map<string, Account[]>();
  for (const account of owned) {
    const list = grouped.get(account.currency) ?? [];
    list.push(account);
    grouped.set(account.currency, list);
  }
  const byCurrency: Record<string, CustomerPosition> = {};
  const currencies: string[] = [];
  for (const [currency, group] of grouped) {
    const projected = projectCustomerPosition(ledger, customerId, group, []);
    if (isErr(projected)) {
      return projected;
    }
    byCurrency[currency] = projected.value;
    currencies.push(currency);
  }
  currencies.sort();
  return ok(
    Object.freeze({
      customerId,
      currencies: Object.freeze(currencies),
      byCurrency: Object.freeze(byCurrency),
    }),
  );
}

/**
 * Consolidated valuation requires explicit FX rates with timestamp/source.
 * A blended total without that context is refused.
 */
export function blendCustomerPosition(
  indexed: CurrencyIndexedCustomerPosition,
  conversions: readonly FxConversion[],
  targetCurrency: string,
): Result<CustomerPosition, MixedCurrencyWithoutConversion> {
  if (indexed.currencies.length === 0) {
    return ok(CustomerPosition.assemble(indexed.customerId, emptyBreakdown(targetCurrency)));
  }
  if (indexed.currencies.length > 1 && conversions.length === 0) {
    return err({
      code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
      currencies: indexed.currencies,
      message:
        'mixed currencies with no rate supplied; refusing to return a wrong number',
    });
  }
  let deposits = classified('deposits', Money.zero(targetCurrency));
  let investments = classified('investments', Money.zero(targetCurrency));
  let digitalAssets = classified('digital_assets', Money.zero(targetCurrency));
  let rewards = classified('rewards', Money.zero(targetCurrency));
  let pending = classified('pending', Money.zero(targetCurrency));
  for (const currency of indexed.currencies) {
    const position = indexed.byCurrency[currency];
    if (!position) {
      continue;
    }
    const converted = convertBreakdown(position.breakdown, currency, targetCurrency, conversions);
    if (isErr(converted)) {
      return converted;
    }
    deposits = classified('deposits', deposits.total.plus(converted.value.deposits.total));
    investments = classified(
      'investments',
      investments.total.plus(converted.value.investments.total),
    );
    digitalAssets = classified(
      'digital_assets',
      digitalAssets.total.plus(converted.value.digital_assets.total),
    );
    rewards = classified('rewards', rewards.total.plus(converted.value.rewards.total));
    pending = classified('pending', pending.total.plus(converted.value.pending.total));
  }
  return ok(
    CustomerPosition.assemble(indexed.customerId, {
      deposits,
      investments,
      digital_assets: digitalAssets,
      rewards,
      pending,
    }),
  );
}

function emptyBreakdown(currency: string): PositionBreakdown {
  return {
    deposits: classified('deposits', Money.zero(currency)),
    investments: classified('investments', Money.zero(currency)),
    digital_assets: classified('digital_assets', Money.zero(currency)),
    rewards: classified('rewards', Money.zero(currency)),
    pending: classified('pending', Money.zero(currency)),
  };
}

function convertBreakdown(
  breakdown: PositionBreakdown,
  from: string,
  to: string,
  conversions: readonly FxConversion[],
): Result<PositionBreakdown, MixedCurrencyWithoutConversion> {
  const convert = (amount: Money): Result<Money, MixedCurrencyWithoutConversion> => {
    if (amount.currency === to) {
      return ok(amount);
    }
    const conversion = conversions.find((c) => c.from === amount.currency && c.to === to);
    if (!conversion) {
      return err({
        code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
        currencies: [from, to],
        message: `no FX conversion supplied for ${from} → ${to}`,
      });
    }
    return ok(applyFxConversion(amount, conversion));
  };
  const deposits = convert(breakdown.deposits.total);
  const investments = convert(breakdown.investments.total);
  const digital = convert(breakdown.digital_assets.total);
  const rewards = convert(breakdown.rewards.total);
  const pending = convert(breakdown.pending.total);
  if (isErr(deposits)) return deposits;
  if (isErr(investments)) return investments;
  if (isErr(digital)) return digital;
  if (isErr(rewards)) return rewards;
  if (isErr(pending)) return pending;
  return ok({
    deposits: classified('deposits', deposits.value),
    investments: classified('investments', investments.value),
    digital_assets: classified('digital_assets', digital.value),
    rewards: classified('rewards', rewards.value),
    pending: classified('pending', pending.value),
  });
}

function classified<B extends PositionBucket>(
  bucket: B,
  total: Money,
): ClassifiedClassTotal<B> {
  const tag = BUCKET_CLASSIFICATION[bucket];
  return Object.freeze({
    accountClass: bucket,
    classification: Object.freeze({
      accountClass: bucket,
      insurance: tag.insurance,
      realization: tag.realization,
    }),
    total,
  });
}

