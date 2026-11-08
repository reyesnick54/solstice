import type { UtcInstant } from '@solstice/domain';
import type { ShadowSettlementState, ShadowTradeSide } from './taxonomy.ts';

/** Research-only posture; never customer ledger or live capital. */
export type ShadowResearchPosture = {
  readonly financialEffectCreated: false;
  readonly customerMoneyUsed: false;
  readonly liveCapital: false;
};

export const SHADOW_RESEARCH_POSTURE: ShadowResearchPosture = Object.freeze({
  financialEffectCreated: false,
  customerMoneyUsed: false,
  liveCapital: false,
});

export type ShadowCampaignPolicy = {
  /** When false, realized PnL accrues to non-deployable surplus (not buying power). */
  readonly reinvestRealizedProfits: boolean;
  /** When set, caps deployable capital at start + this increment (minor units string). */
  readonly additionalDeployableMinor: string | null;
  readonly settlementDelayDays: number;
};

export type ShadowCapitalRegistration = {
  readonly schema: 'sunrey.helios.shadow-capital-registration.v1';
  readonly registrationId: string;
  readonly startingNotionalMinor: string;
  readonly currency: string;
  readonly registeredAt: UtcInstant;
  readonly registrationFingerprint: string;
};

export type ShadowCapitalAccount = {
  readonly accountId: string;
  readonly registration: ShadowCapitalRegistration;
  readonly posture: ShadowResearchPosture;
  readonly campaignPolicy: ShadowCampaignPolicy;
  readonly strategyIds: readonly string[];
};

export type ShadowCash = {
  readonly currency: string;
  readonly settledMinor: string;
  readonly unsettledMinor: string;
  readonly reservedMinor: string;
  /** Realized gains blocked from redeployment when reinvestRealizedProfits is false. */
  readonly nonDeployableMinor: string;
};

export type ShadowPosition = {
  readonly instrumentId: string;
  readonly strategyId: string;
  readonly quantityMinor: string;
  readonly settledQuantityMinor: string;
  readonly unsettledQuantityMinor: string;
  readonly averageCostMinor: string;
  readonly markPriceMinor: string | null;
};

export type ShadowLot = {
  readonly lotId: string;
  readonly instrumentId: string;
  readonly strategyId: string;
  readonly quantityRemainingMinor: string;
  readonly costBasisTotalMinor: string;
  readonly openedAt: UtcInstant;
};

export type ShadowTrade = {
  readonly tradeId: string;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly strategyId: string;
  readonly side: ShadowTradeSide;
  readonly quantityMinor: string;
  readonly priceMinor: string;
  readonly feeMinor: string;
  readonly notionalMinor: string;
  readonly settlementState: ShadowSettlementState;
  readonly tradeAt: UtcInstant;
  readonly settleAfter: UtcInstant;
  readonly settledAt: UtcInstant | null;
};

export type ShadowPnL = {
  readonly currency: string;
  readonly realizedMinor: string;
  readonly unrealizedMinor: string;
  readonly feesMinor: string;
  readonly cash: ShadowCash;
  readonly navMinor: string;
  readonly grossExposureMinor: string;
  readonly netExposureMinor: string;
};

export type ShadowEquityCurvePoint = {
  readonly at: UtcInstant;
  readonly navMinor: string;
  readonly cumulativeDeclaredFlowMinor: string;
  readonly registrationId: string;
};

export type ShadowEquityCurve = {
  readonly accountId: string;
  readonly registrationId: string;
  readonly points: readonly ShadowEquityCurvePoint[];
};

export type ShadowCapitalFailure = {
  readonly code: import('./taxonomy.ts').ShadowCapitalFailureCode;
  readonly message: string;
};

export type ShadowCapitalStrategyRollups = {
  readonly realizedMinorByStrategy: Readonly<Record<string, string>>;
  readonly feesMinorByStrategy: Readonly<Record<string, string>>;
};

export type ShadowCapitalAccountSnapshot = {
  readonly schema: typeof import('./taxonomy.ts').SHADOW_CAPITAL_SCHEMA;
  readonly account: ShadowCapitalAccount;
  readonly cash: ShadowCash;
  readonly positions: readonly ShadowPosition[];
  readonly lots: readonly ShadowLot[];
  readonly trades: readonly ShadowTrade[];
  readonly pnl: ShadowPnL;
  readonly equityCurve: ShadowEquityCurve;
  readonly strategyRollups: ShadowCapitalStrategyRollups;
  readonly declaredFlowMinor: string;
  readonly sequence: number;
};
