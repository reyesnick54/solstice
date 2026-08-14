import type { Money } from './money.ts';

export const RISK_LIMIT_TYPES = [
  'MAX_POSITION',
  'MAX_GROSS_EXPOSURE',
  'MAX_NET_EXPOSURE',
  'LEVERAGE',
  'CONCENTRATION',
  'LIQUIDITY',
  'DAILY_LOSS',
  'ROLLING_DRAWDOWN',
  'VOLATILITY',
  'EXPECTED_SHORTFALL',
  'STRATEGY_LIMIT',
  'COUNTERPARTY_LIMIT',
  'MARKET_IMPACT',
] as const;

export type RiskLimitType = (typeof RISK_LIMIT_TYPES)[number];

export type RiskAllow = {
  readonly kind: 'ALLOW';
  readonly final: false;
};

export type RiskReduce = {
  readonly kind: 'REDUCE';
  readonly final: false;
  readonly scaledQuantityMicros: bigint;
  readonly limit: RiskLimitType;
  readonly reason: string;
};

/**
 * A Risk Engine refusal is FINAL. There is no override, waive, force-allow,
 * or meta-allocator path that can turn this into ALLOW or REDUCE.
 * `final: true` is part of the type, not a convention.
 */
export type RiskRefuse = {
  readonly kind: 'REFUSE';
  readonly final: true;
  readonly limit: RiskLimitType;
  readonly reason: string;
};

export type RiskVerdict = RiskAllow | RiskReduce | RiskRefuse;

/** Only ALLOW and REDUCE may proceed to execution. REFUSE is not a member. */
export type AdmissibleVerdict = RiskAllow | RiskReduce;

export type RiskOverridePath = never;

export type KillSwitchScopeKind =
  | 'ALL_TRADING'
  | 'STRATEGY'
  | 'AGENT_RUNTIME'
  | 'BROKER_CONNECTIVITY';

export type KillSwitchScope =
  | { readonly kind: 'ALL_TRADING' }
  | { readonly kind: 'STRATEGY'; readonly strategyId: string }
  | { readonly kind: 'AGENT_RUNTIME' }
  | { readonly kind: 'BROKER_CONNECTIVITY' };

export type RiskRequest = {
  readonly strategyId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityMicros: bigint;
  readonly priceMinorUnits: bigint;
  readonly currency: string;
  readonly proposedNotional: Money;
  readonly currentPositionMicros: bigint;
  readonly currentGrossMinorUnits: bigint;
  readonly currentNetMinorUnits: bigint;
  readonly equityMinorUnits: bigint;
  readonly dailyRealizedLossMinorUnits: bigint;
  readonly peakEquityMinorUnits: bigint;
  readonly troughEquityMinorUnits: bigint;
  readonly volatilityMadBps: bigint;
  readonly expectedShortfallBps: bigint;
  readonly largestPositionMinorUnits: bigint;
  readonly instrumentLiquid: boolean;
  readonly counterpartyId: string;
  readonly counterpartyNotionalMinorUnits: bigint;
  readonly averageDailyVolumeMicros: bigint;
  readonly strategyGrossMinorUnits: bigint;
};

export type RiskLimits = {
  readonly maxPositionMicros: bigint;
  readonly maxGrossExposureMinorUnits: bigint;
  readonly maxNetExposureMinorUnits: bigint;
  readonly maxLeverageNumerator: bigint;
  readonly maxLeverageDenominator: bigint;
  readonly maxConcentrationNumerator: bigint;
  readonly maxConcentrationDenominator: bigint;
  readonly maxDailyLossMinorUnits: bigint;
  readonly maxDrawdownMinorUnits: bigint;
  readonly maxVolatilityMadBps: bigint;
  readonly maxExpectedShortfallBps: bigint;
  readonly maxStrategyGrossMinorUnits: bigint;
  readonly maxCounterpartyMinorUnits: bigint;
  readonly maxMarketImpactNumerator: bigint;
  readonly maxMarketImpactDenominator: bigint;
};

export function isAdmissible(verdict: RiskVerdict): verdict is AdmissibleVerdict {
  return verdict.kind !== 'REFUSE';
}

export function isFinalRefusal(verdict: RiskVerdict): verdict is RiskRefuse {
  return verdict.kind === 'REFUSE' && verdict.final === true;
}
