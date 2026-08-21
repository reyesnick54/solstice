import { Money, RoundingMode } from '../../money/src/money.ts';
import type { RationalRate } from '../../money/src/money.ts';

/**
 * Server-controlled FX pricing. Clients cannot supply a rate, spread, or fee.
 * Percentage terms are rational bigint fractions, never IEEE-754.
 */
export const DEFAULT_PRICING_VERSION = 'sim-fx-pricing-v1';

export type FxFeeKind = 'FIXED' | 'PERCENTAGE' | 'SPREAD' | 'TIERED';

export type FxPricingTier = {
  readonly upToSourceMinorInclusive: bigint;
  readonly fixedFeeMinor: bigint;
  readonly percentage: RationalRate;
};

export type FxPairPricing = {
  readonly pair: string;
  readonly spreadNumerator: bigint;
  readonly spreadDenominator: bigint;
  readonly fixedFeeMinor: bigint;
  readonly percentage: RationalRate;
  readonly tiers: readonly FxPricingTier[];
  readonly discloseSpread: boolean;
};

export type FxPricingPolicy = {
  readonly version: string;
  readonly simulation: true;
  readonly live: false;
  readonly defaultFixedFeeByCurrency: Readonly<Record<string, bigint>>;
  readonly pairs: Readonly<Record<string, FxPairPricing>>;
  readonly customerOverrides: Readonly<Record<string, Partial<FxPairPricing>>>;
  readonly productOverrides: Readonly<Record<string, Partial<FxPairPricing>>>;
};

const ZERO_PCT: RationalRate = { numerator: 0n, denominator: 1n };

function pairPricing(
  pair: string,
  spreadNumerator: bigint,
  spreadDenominator: bigint,
  fixedFeeMinor: bigint,
  discloseSpread = true,
): FxPairPricing {
  return Object.freeze({
    pair,
    spreadNumerator,
    spreadDenominator,
    fixedFeeMinor,
    percentage: ZERO_PCT,
    tiers: Object.freeze([]),
    discloseSpread,
  });
}

export const SIMULATION_PRICING_POLICY: FxPricingPolicy = Object.freeze({
  version: DEFAULT_PRICING_VERSION,
  simulation: true,
  live: false,
  defaultFixedFeeByCurrency: Object.freeze({
    USD: 1500n,
    SAR: 5000n,
    GBP: 1200n,
    EUR: 1400n,
    AED: 5500n,
  }),
  pairs: Object.freeze({
    'USD/SAR': pairPricing('USD/SAR', 3n, 1000n, 1500n),
    'SAR/USD': pairPricing('SAR/USD', 3n, 3745n, 5000n),
    'USD/GBP': pairPricing('USD/GBP', 2n, 1000n, 1200n),
    'GBP/USD': pairPricing('GBP/USD', 2n, 786n, 1200n),
    'USD/EUR': pairPricing('USD/EUR', 2n, 1000n, 1400n),
    'EUR/USD': pairPricing('EUR/USD', 2n, 916n, 1400n),
    'USD/AED': pairPricing('USD/AED', 5n, 1000n, 5500n),
    'AED/USD': pairPricing('AED/USD', 5n, 3660n, 5500n),
    'GBP/SAR': pairPricing('GBP/SAR', 4n, 1000n, 1200n),
    'SAR/GBP': pairPricing('SAR/GBP', 4n, 4740n, 5000n),
  }),
  customerOverrides: Object.freeze({}),
  productOverrides: Object.freeze({}),
});

export type PricingContext = {
  readonly customerId?: string;
  readonly productId?: string;
};

export function resolvePairPricing(
  policy: FxPricingPolicy,
  pair: string,
  context: PricingContext = {},
): FxPairPricing | undefined {
  const base = policy.pairs[pair];
  if (!base) {
    return undefined;
  }
  const customer = context.customerId ? policy.customerOverrides[context.customerId] : undefined;
  const product = context.productId ? policy.productOverrides[context.productId] : undefined;
  return Object.freeze({
    ...base,
    ...product,
    ...customer,
    pair: base.pair,
    tiers: Object.freeze([...(customer?.tiers ?? product?.tiers ?? base.tiers)]),
    percentage: customer?.percentage ?? product?.percentage ?? base.percentage,
  });
}

export function applyFixedAndPercentageFee(
  sourceAmount: Money,
  pricing: FxPairPricing,
  fallbackFixedMinor: bigint,
): Money {
  const tier = selectTier(sourceAmount.minorUnits, pricing.tiers);
  const fixedMinor = tier?.fixedFeeMinor ?? pricing.fixedFeeMinor ?? fallbackFixedMinor;
  const percentage = tier?.percentage ?? pricing.percentage;
  const percentFee = sourceAmount.allocate(percentage.numerator, percentage.denominator, RoundingMode.HALF_EVEN);
  return Money.fromMinorUnits(fixedMinor, sourceAmount.currency).plus(percentFee);
}

function selectTier(
  sourceMinor: bigint,
  tiers: readonly FxPricingTier[],
): FxPricingTier | undefined {
  if (tiers.length === 0) {
    return undefined;
  }
  const ordered = [...tiers].sort((a, b) =>
    a.upToSourceMinorInclusive < b.upToSourceMinorInclusive ? -1 : 1,
  );
  return ordered.find((tier) => sourceMinor <= tier.upToSourceMinorInclusive) ?? ordered[ordered.length - 1];
}

export function applySpreadToProviderRate(input: {
  readonly providerNumerator: bigint;
  readonly providerDenominator: bigint;
  readonly spreadNumerator: bigint;
  readonly spreadDenominator: bigint;
}): RationalRate {
  if (input.providerDenominator === 0n || input.spreadDenominator === 0n) {
    throw new RangeError('spread and provider denominators must be non-zero');
  }
  const numerator = input.providerNumerator * input.spreadDenominator - input.spreadNumerator * input.providerDenominator;
  const denominator = input.providerDenominator * input.spreadDenominator;
  if (numerator <= 0n) {
    throw new RangeError('spread cannot invert or zero a customer rate');
  }
  return { numerator, denominator };
}
