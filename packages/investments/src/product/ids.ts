import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type PortfolioId = Brand<string, 'PortfolioId'>;
export type InstrumentProductId = Brand<string, 'InstrumentProductId'>;
export type InvestmentProposalId = Brand<string, 'InvestmentProposalId'>;
export type CashReservationId = Brand<string, 'CashReservationId'>;
export type TargetAllocationId = Brand<string, 'TargetAllocationId'>;
export type PerformanceReportId = Brand<string, 'PerformanceReportId'>;

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asPortfolioId(value: string): PortfolioId {
  return asNonEmpty(value, 'PortfolioId');
}

export function asInstrumentProductId(value: string): InstrumentProductId {
  return asNonEmpty(value, 'InstrumentProductId');
}

export function asInvestmentProposalId(value: string): InvestmentProposalId {
  return asNonEmpty(value, 'InvestmentProposalId');
}

export function asCashReservationId(value: string): CashReservationId {
  return asNonEmpty(value, 'CashReservationId');
}

export function asTargetAllocationId(value: string): TargetAllocationId {
  return asNonEmpty(value, 'TargetAllocationId');
}

export function asPerformanceReportId(value: string): PerformanceReportId {
  return asNonEmpty(value, 'PerformanceReportId');
}
