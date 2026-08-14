import type { Money } from './money.ts';
import type { AccountId, CustomerId } from './ids.ts';
import type { UtcInstant } from './time.ts';
import type { RiskCeiling } from './account-class.ts';

/**
 * Legal investment account class. Insured deposits never share this class.
 * Crossing requires a named disclosed class bridge.
 */
export const INVESTMENT_LEGAL_CLASSES = ['INVESTMENT_ASSET'] as const;
export type InvestmentLegalClass = (typeof INVESTMENT_LEGAL_CLASSES)[number];

/**
 * Distinct ledger positions inside an investment account.
 * Cash and securities never share a posting class.
 */
export const INVESTMENT_POSITION_CLASSES = [
  'INVESTMENT_CASH',
  'INVESTMENT_SECURITY',
] as const;
export type InvestmentPositionClass = (typeof INVESTMENT_POSITION_CLASSES)[number];

export const HARVEST_SHARES = [0, 25, 50, 75, 100] as const;
export type HarvestSharePercent = (typeof HARVEST_SHARES)[number];

export type InvestmentAccountAgreement = {
  readonly version: string;
  readonly acceptedAt: UtcInstant;
};

export type CustomerRiskProfile = {
  readonly ceiling: RiskCeiling;
  readonly assessedAt: UtcInstant;
  readonly current: true;
};

export type InvestmentDisclosure = {
  readonly version: string;
  readonly acknowledgedAt: UtcInstant;
  readonly current: true;
};

export type CustomerTransferAuthorization = {
  readonly authorized: true;
  readonly authorizedAt: UtcInstant;
  readonly scope: 'DEPOSIT_TO_INVESTMENT_SWEEP' | 'INVESTMENT_TO_DEPOSIT_HARVEST';
};

export type InvestmentAccountPreconditions = {
  readonly agreement: InvestmentAccountAgreement;
  readonly riskProfile: CustomerRiskProfile;
  readonly disclosure: InvestmentDisclosure;
  readonly transferAuthorization: CustomerTransferAuthorization;
};

export type MissingInvestmentPrecondition =
  | 'MISSING_INVESTMENT_ACCOUNT_AGREEMENT'
  | 'MISSING_CURRENT_RISK_PROFILE'
  | 'MISSING_CURRENT_DISCLOSURE'
  | 'MISSING_CUSTOMER_TRANSFER_AUTHORIZATION';

/**
 * Realized, settled profit. The only harvestable economic result.
 * Cannot be constructed from an unrealized mark.
 */
export type RealizedSettledProfit = {
  readonly kind: 'REALIZED_SETTLED';
  readonly amount: Money;
  readonly settled: true;
  readonly withdrawable: true;
};

/**
 * Unrealized mark-to-market. Structurally unsweepable.
 * Assigning this to a harvest function is a type error.
 */
export type UnrealizedPnL = {
  readonly kind: 'UNREALIZED';
  readonly amount: Money;
  readonly settled: false;
  readonly withdrawable: false;
};

export type RealizedInvestmentLoss = {
  readonly kind: 'REALIZED_LOSS';
  readonly amount: Money;
  readonly settled: true;
  readonly withdrawable: false;
};

export type HarvestableProfit = RealizedSettledProfit;

/** Unrealized marks are rejected at the type level, not by a runtime flag. */
export type RejectUnrealized<T> = T extends { readonly kind: 'UNREALIZED' } ? never : T;

export type QuantityMicros = bigint;

export const SHARE_MICROS = 1_000_000n;

export type SimulatedPrice = {
  readonly instrumentId: string;
  readonly minorUnitsPerShare: bigint;
  readonly currency: string;
  readonly asOf: UtcInstant;
  readonly source: 'SIMULATED_SEEDED' | 'SIMULATED_REPLAY';
};

export type InvestmentPosition = {
  readonly instrumentId: string;
  readonly quantityMicros: QuantityMicros;
  readonly costBasis: Money;
  readonly accountId: AccountId;
};

export type PortfolioValuation = {
  readonly investmentAccountId: AccountId;
  readonly customerId: CustomerId;
  readonly asOf: UtcInstant;
  readonly priceSource: 'SIMULATED_SEEDED' | 'SIMULATED_REPLAY';
  readonly presentedAsCash: false;
  readonly scopeLabel: 'INVESTMENT_ACCOUNT_ONLY';
  readonly cash: Money;
  readonly marketValue: Money;
  readonly realizedSettled: RealizedSettledProfit;
  readonly unrealized: UnrealizedPnL;
};

export function isHarvestShare(value: unknown): value is HarvestSharePercent {
  return (
    typeof value === 'number' &&
    (HARVEST_SHARES as readonly number[]).includes(value)
  );
}
