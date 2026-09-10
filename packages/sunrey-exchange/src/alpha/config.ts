import {
  AUTHORIZED_ALPHA_TESTNET_ALLOCATION,
  SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE,
  SUNREY_ALPHA_MARKET_MAKER_ID,
} from './ids.ts';

/**
 * Documented Internal Alpha reference levels and spread.
 * Establishes initial liquidity; after trading begins, last trade and order-book
 * state become authoritative for the SRC/MRC native pair.
 */
export type AlphaLiquidityConfig = {
  readonly participantId: typeof SUNREY_ALPHA_MARKET_MAKER_ID;
  readonly liquiditySource: typeof SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE;
  readonly allocationAuthority: typeof AUTHORIZED_ALPHA_TESTNET_ALLOCATION;
  readonly referencePrices: {
    /** USD minor units (cents) per 1.000000 SUNREY_COIN. */
    readonly srcUsdMinorPerUnit: bigint;
    /** USD minor units (cents) per 1.000000 MOONREY_COIN. */
    readonly mrcUsdMinorPerUnit: bigint;
    /** MOONREY price units per 1 SUNREY_COIN at 6-decimal native precision. */
    readonly srcMrcMidPriceUnits: bigint;
  };
  readonly spreadBps: bigint;
  readonly depthBands: readonly {
    readonly quantity: bigint;
    readonly spreadMultiplierBps: bigint;
  }[];
  readonly initialAllocation: {
    readonly sandboxUsdMinor: bigint;
    readonly sunreyScaled: bigint;
    readonly moonreyScaled: bigint;
  };
  readonly inventoryThresholds: {
    readonly sunreyScaled: bigint;
    readonly moonreyScaled: bigint;
    readonly sandboxUsdMinor: bigint;
  };
};

/** Default Internal Alpha configuration for team sandbox trading. */
export function defaultAlphaLiquidityConfig(
  overrides: Partial<Omit<AlphaLiquidityConfig, 'participantId' | 'liquiditySource' | 'allocationAuthority'>> = {},
): AlphaLiquidityConfig {
  return Object.freeze({
    participantId: SUNREY_ALPHA_MARKET_MAKER_ID,
    liquiditySource: SUNREY_ALPHA_INTERNAL_LIQUIDITY_SOURCE,
    allocationAuthority: AUTHORIZED_ALPHA_TESTNET_ALLOCATION,
    referencePrices: Object.freeze({
      srcUsdMinorPerUnit: 10_000n,
      mrcUsdMinorPerUnit: 4_000n,
      srcMrcMidPriceUnits: 2_500_000n,
    }),
    spreadBps: 200n,
    depthBands: Object.freeze([
      { quantity: 50n, spreadMultiplierBps: 10_000n },
      { quantity: 25n, spreadMultiplierBps: 10_500n },
      { quantity: 10n, spreadMultiplierBps: 11_000n },
    ]),
    initialAllocation: Object.freeze({
      sandboxUsdMinor: 1_000_000_00n,
      sunreyScaled: 1_000n * 1_000_000n,
      moonreyScaled: 2_500n * 1_000_000n,
    }),
    inventoryThresholds: Object.freeze({
      sunreyScaled: 10n * 1_000_000n,
      moonreyScaled: 25n * 1_000_000n,
      sandboxUsdMinor: 10_000_00n,
    }),
    ...overrides,
    referencePrices: Object.freeze({
      ...{
        srcUsdMinorPerUnit: 10_000n,
        mrcUsdMinorPerUnit: 4_000n,
        srcMrcMidPriceUnits: 2_500_000n,
      },
      ...overrides.referencePrices,
    }),
    depthBands: overrides.depthBands ?? Object.freeze([
      { quantity: 50n, spreadMultiplierBps: 10_000n },
      { quantity: 25n, spreadMultiplierBps: 10_500n },
      { quantity: 10n, spreadMultiplierBps: 11_000n },
    ]),
    initialAllocation: Object.freeze({
      ...{
        sandboxUsdMinor: 1_000_000_00n,
        sunreyScaled: 1_000n * 1_000_000n,
        moonreyScaled: 2_500n * 1_000_000n,
      },
      ...overrides.initialAllocation,
    }),
    inventoryThresholds: Object.freeze({
      ...{
        sunreyScaled: 10n * 1_000_000n,
        moonreyScaled: 25n * 1_000_000n,
        sandboxUsdMinor: 10_000_00n,
      },
      ...overrides.inventoryThresholds,
    }),
  });
}
