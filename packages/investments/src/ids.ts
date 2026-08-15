import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type InvestmentAccountId = Brand<string, 'InvestmentAccountId'>;
export type InstrumentId = Brand<string, 'InstrumentId'>;
export type InstrumentSymbol = Brand<string, 'InstrumentSymbol'>;
export type MarketId = Brand<string, 'MarketId'>;
export type PaperOrderId = Brand<string, 'PaperOrderId'>;
export type FillId = Brand<string, 'FillId'>;
export type LotId = Brand<string, 'LotId'>;
export type SettlementId = Brand<string, 'SettlementId'>;
export type ValuationId = Brand<string, 'ValuationId'>;
export type CorporateActionId = Brand<string, 'CorporateActionId'>;
export type ReconciliationId = Brand<string, 'ReconciliationId'>;

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asInvestmentAccountId(value: string): InvestmentAccountId {
  return asNonEmpty(value, 'InvestmentAccountId');
}

export function asInstrumentId(value: string): InstrumentId {
  return asNonEmpty(value, 'InstrumentId');
}

export function asInstrumentSymbol(value: string): InstrumentSymbol {
  return asNonEmpty(value, 'InstrumentSymbol');
}

export function asMarketId(value: string): MarketId {
  return asNonEmpty(value, 'MarketId');
}

export function asPaperOrderId(value: string): PaperOrderId {
  return asNonEmpty(value, 'PaperOrderId');
}

export function asFillId(value: string): FillId {
  return asNonEmpty(value, 'FillId');
}

export function asLotId(value: string): LotId {
  return asNonEmpty(value, 'LotId');
}

export function asSettlementId(value: string): SettlementId {
  return asNonEmpty(value, 'SettlementId');
}

export function asValuationId(value: string): ValuationId {
  return asNonEmpty(value, 'ValuationId');
}

export function asCorporateActionId(value: string): CorporateActionId {
  return asNonEmpty(value, 'CorporateActionId');
}

export function asReconciliationId(value: string): ReconciliationId {
  return asNonEmpty(value, 'ReconciliationId');
}
