import type { CurrencyCode } from '../../../domain/src/currency.ts';
import { Money } from '../../../money/src/money.ts';
import type { Instrument } from '../instrument.ts';
import { freezeInstrument } from '../instrument.ts';
import type { InstrumentId } from '../ids.ts';
import { SIM_ETF_1, SIM_MARKET_US } from '../seed.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { asInstrumentId, asInstrumentSymbol, asMarketId } from '../ids.ts';
import { wholeShares } from '../quantity.ts';
import {
  type InstrumentLiquidityClass,
  type InstrumentProductStatus,
  type InstrumentRiskCategory,
  type ProductAssetClass,
} from './types.ts';

export type InstrumentFeeSchedule = {
  readonly known: boolean;
  readonly explicitFeeMinorUnits: bigint;
  readonly currency: string;
};

export type InstrumentMinimums = {
  readonly quantityUnits: bigint;
  readonly amount: Money | null;
};

/**
 * Productized instrument metadata. Extends the paper-core Instrument.
 * Unsupported products exist as catalog rows but are not available.
 */
export type InstrumentProduct = {
  readonly instrumentId: InstrumentId;
  readonly identifier: string;
  readonly displayName: string;
  readonly assetClass: ProductAssetClass;
  readonly currency: CurrencyCode;
  readonly riskCategory: InstrumentRiskCategory;
  readonly liquidity: InstrumentLiquidityClass;
  readonly pricingSource: string;
  readonly jurisdictionEligibility: readonly string[];
  readonly minimums: InstrumentMinimums;
  readonly fees: InstrumentFeeSchedule;
  readonly provider: string;
  readonly status: InstrumentProductStatus;
  readonly digitalAssetAllowed: false | true;
  readonly simulation: true;
  readonly liveListing: false;
  readonly paperTradable: boolean;
};

function qty(shares: bigint) {
  const value = wholeShares(shares);
  if (!value.ok) {
    throw new Error(value.error.message);
  }
  return value.value;
}

function product(row: InstrumentProduct): InstrumentProduct {
  if (row.simulation !== true || row.liveListing !== false) {
    throw new Error('live instrument listings are forbidden');
  }
  if (row.assetClass === 'DIGITAL_ASSET' && row.status === 'AVAILABLE_SIMULATION' && row.digitalAssetAllowed !== true) {
    throw new Error('digital assets cannot be marked available unless explicitly allowed');
  }
  return Object.freeze({
    ...row,
    jurisdictionEligibility: Object.freeze([...row.jurisdictionEligibility]),
    minimums: Object.freeze({ ...row.minimums }),
    fees: Object.freeze({ ...row.fees }),
  });
}

const SIM_CASH_USD: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-CASH-USD'),
  identifier: 'SIM-CASH-USD',
  displayName: 'Simulated USD cash sleeve',
  assetClass: 'CASH',
  currency: asCurrencyCode('USD'),
  riskCategory: 'LOW',
  liquidity: 'HIGH',
  pricingSource: 'LEDGER_CASH',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: 0n, amount: Money.zero('USD') },
  fees: { known: true, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: false,
});

const SIM_MM_USD: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-MM-1'),
  identifier: 'SIM-MM-1',
  displayName: 'Simulated USD money-market fixture',
  assetClass: 'MONEY_MARKET',
  currency: asCurrencyCode('USD'),
  riskCategory: 'LOW',
  liquidity: 'HIGH',
  pricingSource: 'SIMULATED_DETERMINISTIC',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: qty(1n).units, amount: Money.fromMinorUnits(100n, 'USD') },
  fees: { known: true, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: false,
});

const SIM_EQ_1: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-EQ-1'),
  identifier: 'SIM-EQ-1',
  displayName: 'Simulated equity fixture',
  assetClass: 'EQUITY',
  currency: asCurrencyCode('USD'),
  riskCategory: 'HIGH',
  liquidity: 'MEDIUM',
  pricingSource: 'SIMULATED_DETERMINISTIC',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: qty(1n).units, amount: null },
  fees: { known: true, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: true,
});

const SIM_ETF_PRODUCT: InstrumentProduct = product({
  instrumentId: SIM_ETF_1.instrumentId,
  identifier: SIM_ETF_1.symbol,
  displayName: SIM_ETF_1.displayName,
  assetClass: 'ETF',
  currency: SIM_ETF_1.currency,
  riskCategory: 'MODERATE',
  liquidity: 'HIGH',
  pricingSource: 'SIMULATED_DETERMINISTIC',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: SIM_ETF_1.minimumQuantityIncrement.units, amount: null },
  fees: { known: true, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: true,
});

const SIM_BOND_1: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-BOND-1'),
  identifier: 'SIM-BOND-1',
  displayName: 'Simulated fixed-income fixture',
  assetClass: 'FIXED_INCOME',
  currency: asCurrencyCode('USD'),
  riskCategory: 'MODERATE',
  liquidity: 'MEDIUM',
  pricingSource: 'SIMULATED_DETERMINISTIC',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: qty(1n).units, amount: Money.fromMinorUnits(10_000n, 'USD') },
  fees: { known: false, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: true,
});

const SIM_FUND_1: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-FUND-1'),
  identifier: 'SIM-FUND-1',
  displayName: 'Simulated fund fixture',
  assetClass: 'FUND',
  currency: asCurrencyCode('USD'),
  riskCategory: 'MODERATE',
  liquidity: 'LOW',
  pricingSource: 'SIMULATED_DETERMINISTIC',
  jurisdictionEligibility: Object.freeze(['GB', 'US']),
  minimums: { quantityUnits: qty(1n).units, amount: Money.fromMinorUnits(1_000n, 'USD') },
  fees: { known: false, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'sunrey-simulation',
  status: 'AVAILABLE_SIMULATION',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: false,
});

/**
 * Digital-asset catalog row. Present so the taxonomy is complete, but
 * not available. Do not treat this as a live listing.
 */
const SIM_DIGITAL_UNAVAILABLE: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-DA-UNAVAILABLE'),
  identifier: 'SIM-DA-UNAVAILABLE',
  displayName: 'Digital asset (not available on this path)',
  assetClass: 'DIGITAL_ASSET',
  currency: asCurrencyCode('USD'),
  riskCategory: 'HIGH',
  liquidity: 'UNKNOWN',
  pricingSource: 'UNAVAILABLE',
  jurisdictionEligibility: Object.freeze([]),
  minimums: { quantityUnits: 0n, amount: null },
  fees: { known: false, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'none',
  status: 'UNAVAILABLE',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: false,
});

const SIM_OTHER_RESEARCH: InstrumentProduct = product({
  instrumentId: asInstrumentId('SIM-OTHER-RESEARCH'),
  identifier: 'SIM-OTHER-RESEARCH',
  displayName: 'Other approved product (research required)',
  assetClass: 'OTHER_APPROVED_PRODUCT',
  currency: asCurrencyCode('USD'),
  riskCategory: 'UNKNOWN',
  liquidity: 'UNKNOWN',
  pricingSource: 'UNAVAILABLE',
  jurisdictionEligibility: Object.freeze([]),
  minimums: { quantityUnits: 0n, amount: null },
  fees: { known: false, explicitFeeMinorUnits: 0n, currency: 'USD' },
  provider: 'none',
  status: 'RESEARCH_REQUIRED',
  digitalAssetAllowed: false,
  simulation: true,
  liveListing: false,
  paperTradable: false,
});

export const SIMULATION_INSTRUMENT_PRODUCTS: readonly InstrumentProduct[] = Object.freeze([
  SIM_CASH_USD,
  SIM_MM_USD,
  SIM_EQ_1,
  SIM_ETF_PRODUCT,
  SIM_BOND_1,
  SIM_FUND_1,
  SIM_DIGITAL_UNAVAILABLE,
  SIM_OTHER_RESEARCH,
]);

export function seedInstrumentProducts(): readonly InstrumentProduct[] {
  return SIMULATION_INSTRUMENT_PRODUCTS;
}

export function isProductAvailable(productRow: InstrumentProduct): boolean {
  return productRow.status === 'AVAILABLE_SIMULATION';
}

export function mapCoreTypeToAssetClass(type: Instrument['instrumentType']): ProductAssetClass {
  if (type === 'CASH_EQUIVALENT') {
    return 'MONEY_MARKET';
  }
  if (type === 'BOND') {
    return 'FIXED_INCOME';
  }
  return type;
}

export function paperInstrumentForProduct(productRow: InstrumentProduct): Instrument | null {
  if (!productRow.paperTradable || !isProductAvailable(productRow)) {
    return null;
  }
  if (productRow.instrumentId === SIM_ETF_1.instrumentId) {
    return SIM_ETF_1;
  }
  if (
    productRow.assetClass !== 'EQUITY' &&
    productRow.assetClass !== 'ETF' &&
    productRow.assetClass !== 'FUND' &&
    productRow.assetClass !== 'FIXED_INCOME' &&
    productRow.assetClass !== 'BOND'
  ) {
    return null;
  }
  const coreType =
    productRow.assetClass === 'FIXED_INCOME' || productRow.assetClass === 'BOND'
      ? 'BOND'
      : productRow.assetClass === 'EQUITY'
        ? 'EQUITY'
        : productRow.assetClass === 'FUND'
          ? 'FUND'
          : 'ETF';
  return freezeInstrument({
    instrumentId: productRow.instrumentId,
    symbol: asInstrumentSymbol(productRow.identifier),
    displayName: productRow.displayName,
    instrumentType: coreType,
    currency: productRow.currency,
    marketId: asMarketId(SIM_MARKET_US),
    status: productRow.status === 'HALTED' ? 'HALTED' : 'ACTIVE',
    fractionalSupported: false,
    minimumQuantityIncrement: qty(1n),
    pricePrecisionMinorDigits: 2n,
    simulation: true,
    listedClaim: 'DETERMINISTIC_FIXTURE',
    createdAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
  });
}
