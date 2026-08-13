import type { Account } from '../../../packages/domain/src/account.ts';
import {
  ACCOUNT_CLASS_CATALOG,
  type InsuranceClassification,
  type PositionBucket,
  type RealizationClassification,
} from '../../../packages/domain/src/account-class.ts';
import type { CustomerId } from '../../../packages/domain/src/customer.ts';
import { err, ok, type Result } from '../../../packages/domain/src/result.ts';
import type { Ledger } from '../../../packages/ledger/src/journal.ts';
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
    currencies.add(posting.amount.currency);
    if (posting.amount.currency !== account.currency) {
      return err({
        code: 'MIXED_CURRENCY_WITHOUT_CONVERSION',
        currencies: [...currencies],
        message: 'account postings span currencies; supply an explicit FX conversion',
      });
    }
    if (posting.direction === 'CREDIT') {
      credits = credits.plus(posting.amount);
    } else {
      debits = debits.plus(posting.amount);
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
    if (isErrResult(raw)) {
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

function isErrResult<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false;
}
