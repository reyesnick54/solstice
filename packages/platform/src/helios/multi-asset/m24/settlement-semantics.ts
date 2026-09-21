import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';

function addDaysUtc(instant: UtcInstant, days: number): UtcInstant {
  const date = new Date(instant);
  date.setUTCDate(date.getUTCDate() + days);
  return asUtcInstant(date.toISOString());
}
import type { M24ExecutionAssetClass, M24SettlementCycle } from './taxonomy.ts';

export type AssetClassSettlementRule = {
  readonly assetClass: M24ExecutionAssetClass;
  readonly cycle: M24SettlementCycle;
  readonly settlementDays: number;
  readonly immediateCashEffect: boolean;
};

export const ASSET_CLASS_SETTLEMENT_RULES: Readonly<Record<M24ExecutionAssetClass, AssetClassSettlementRule>> =
  Object.freeze({
    EQUITY: Object.freeze({
      assetClass: 'EQUITY',
      cycle: 'T_PLUS_1',
      settlementDays: 1,
      immediateCashEffect: false,
    }),
    ETF: Object.freeze({
      assetClass: 'ETF',
      cycle: 'T_PLUS_1',
      settlementDays: 1,
      immediateCashEffect: false,
    }),
    CRYPTO: Object.freeze({
      assetClass: 'CRYPTO',
      cycle: 'T_PLUS_0',
      settlementDays: 0,
      immediateCashEffect: true,
    }),
    FUTURES: Object.freeze({
      assetClass: 'FUTURES',
      cycle: 'T_PLUS_1',
      settlementDays: 1,
      immediateCashEffect: false,
    }),
    FX: Object.freeze({
      assetClass: 'FX',
      cycle: 'T_PLUS_2',
      settlementDays: 2,
      immediateCashEffect: false,
    }),
  });

export function resolveAssetClass(instrumentId: string): M24ExecutionAssetClass {
  if (instrumentId.includes('btc') || instrumentId.includes('eth') || instrumentId.startsWith('crypto_')) {
    return 'CRYPTO';
  }
  if (instrumentId.includes('fut') || instrumentId.includes('cl') || instrumentId.includes('gc')) {
    return 'FUTURES';
  }
  if (instrumentId.includes('fx') || instrumentId.includes('eur') || instrumentId.includes('usd_jpy')) {
    return 'FX';
  }
  if (instrumentId.includes('etf') || instrumentId.includes('spy') || instrumentId.includes('qqq')) {
    return 'ETF';
  }
  return 'EQUITY';
}

export function expectedSettlementDate(tradeDate: UtcInstant, assetClass: M24ExecutionAssetClass): UtcInstant {
  const rule = ASSET_CLASS_SETTLEMENT_RULES[assetClass];
  return addDaysUtc(tradeDate, rule.settlementDays);
}

export function settlementEligible(
  tradeDate: UtcInstant,
  assetClass: M24ExecutionAssetClass,
  now: UtcInstant,
): boolean {
  const expected = expectedSettlementDate(tradeDate, assetClass);
  return now >= expected;
}

export function cashEffectFromFill(
  assetClass: M24ExecutionAssetClass,
  orderState: 'FILLED' | 'SETTLEMENT_PENDING' | 'SETTLED',
): 'NONE' | 'UNSETTLED' | 'SETTLED' {
  const rule = ASSET_CLASS_SETTLEMENT_RULES[assetClass];
  if (orderState === 'FILLED' || orderState === 'SETTLEMENT_PENDING') {
    return rule.immediateCashEffect ? 'SETTLED' : 'UNSETTLED';
  }
  if (orderState === 'SETTLED') {
    return 'SETTLED';
  }
  return 'NONE';
}
