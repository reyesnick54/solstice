import type { UtcInstant } from '@solstice/domain';
import type { Ratio } from '../arithmetic.ts';
import type { RiskPolicyVersion } from '../ids.ts';
import type { LiquidityClass, MarketDataQuality } from '../types.ts';

export const PORTFOLIO_RISK_STATES = [
  'NORMAL',
  'CAUTION',
  'REDUCED_RISK',
  'NEW_ENTRIES_BLOCKED',
  'EXIT_ONLY',
  'EMERGENCY_CLOSE_REQUIRED',
  'PAUSED',
] as const;

export type PortfolioRiskState = (typeof PORTFOLIO_RISK_STATES)[number];

export const KILL_CONTROL_TRIGGERS = [
  'CUSTOMER_PAUSE',
  'COMPLIANCE_PAUSE',
  'PROVIDER_FAILURE',
  'STALE_MARKET_DATA',
  'EXCESSIVE_PORTFOLIO_DRAWDOWN',
  'LOSS_BUDGET_BREACH',
  'SEVERE_LIQUIDITY_DEGRADATION',
  'REPEATED_EXECUTION_FAILURE',
  'RECONCILIATION_FAILURE',
  'OPERATIONAL_EMERGENCY',
] as const;

export type KillControlTrigger = (typeof KILL_CONTROL_TRIGGERS)[number];

export const RISK_ACTION_KINDS = [
  'ALLOW_NEW_ENTRIES',
  'BLOCK_NEW_ENTRIES',
  'REDUCE_EXPOSURE',
  'EXIT_STRATEGY',
  'EXIT_ASSET_CLASS',
  'CLOSE_MANDATE',
] as const;

export type RiskActionKind = (typeof RISK_ACTION_KINDS)[number];

export const ASSET_CLASS_TAGS = [
  'EQUITY',
  'ETF',
  'CRYPTO',
  'COMMODITY',
  'BOND',
  'CASH_EQUIVALENT',
  'FUND',
  'OTHER',
] as const;

export type AssetClassTag = (typeof ASSET_CLASS_TAGS)[number];

export type MandateRiskPolicy = {
  readonly policyId: string;
  readonly mandateId: string;
  readonly customerId: string;
  readonly portfolioId: string;
  readonly version: RiskPolicyVersion;
  readonly effectiveFrom: UtcInstant;
  readonly maximumPositionExposure?: Ratio;
  readonly maximumStrategyExposure?: Ratio;
  readonly maximumAssetClassExposure?: Ratio;
  readonly maximumCorrelatedClusterExposure?: Ratio;
  readonly maximumCryptoExposure?: Ratio;
  readonly maximumCommodityExposure?: Ratio;
  readonly maximumVenueConcentration?: Ratio;
  readonly maximumGrossExposure?: Ratio;
  readonly maximumNetExposure?: Ratio;
  readonly dailyRealizedLossLimitMinor?: bigint;
  readonly dailyTotalLossThresholdMinor?: bigint;
  readonly dailyTotalLossIncludesUnrealized?: boolean;
  readonly maximumPortfolioDrawdown?: Ratio;
  readonly maximumStrategyDrawdown?: Ratio;
  readonly maximumConsecutiveLosses?: number;
  readonly minimumLiquidityMinor?: bigint;
  readonly staleDataBlocksNewEntries?: boolean;
  readonly providerHealthBlocksNewEntries?: boolean;
  readonly cautionPortfolioDrawdown?: Ratio;
  readonly reducedRiskPortfolioDrawdown?: Ratio;
  readonly newEntriesBlockedPortfolioDrawdown?: Ratio;
  readonly exitOnlyPortfolioDrawdown?: Ratio;
  readonly emergencyClosePortfolioDrawdown?: Ratio;
  readonly emergencyClosePermitted?: boolean;
  readonly engineeringOnly: true;
  readonly cannotLoosenMandate: true;
};

export type InstrumentRiskProfile = {
  readonly instrumentId: string;
  readonly assetClass: AssetClassTag;
  readonly venue: string;
  readonly strategyId?: string;
  readonly correlationClusterIds: readonly string[];
  readonly sourceRef: string;
};

export type StrategyExposureFact = {
  readonly strategyId: string;
  readonly grossExposureMinor: bigint;
  readonly netExposureMinor: bigint;
  readonly marketValueMinor: bigint;
};

export type VenueExposureFact = {
  readonly venue: string;
  readonly exposureMinor: bigint;
};

export type ClusterExposureFact = {
  readonly clusterId: string;
  readonly exposureMinor: bigint;
  readonly exposureRatio: Ratio;
  readonly memberInstrumentIds: readonly string[];
};

export type PortfolioPositionRiskFact = {
  readonly instrumentId: string;
  readonly strategyId?: string;
  readonly assetClass: AssetClassTag;
  readonly venue: string;
  readonly marketValueMinor: bigint;
  readonly signedExposureMinor: bigint;
  readonly priceQuality: MarketDataQuality;
  readonly liquidityClass: LiquidityClass;
  readonly sourceRef: string;
};

export type ReconciledEquityPoint = {
  readonly at: UtcInstant;
  readonly equityMinor: bigint;
  readonly cumulativeNetFlowMinor: bigint;
  readonly currency: string;
  readonly reconciled: true;
  readonly sourceRef: string;
};

export type DailyLossLedger = {
  readonly utcDay: string;
  readonly realizedLossMinor: bigint;
  readonly totalLossMinor: bigint;
  readonly consecutiveLossCount: number;
  readonly lastResetAt: UtcInstant;
};

export type StrategyDrawdownFact = {
  readonly strategyId: string;
  readonly peakEquityMinor: bigint;
  readonly currentEquityMinor: bigint;
  readonly drawdownRatio: Ratio;
};

export type PortfolioRiskContext = {
  readonly mandateId: string;
  readonly portfolioId: string;
  readonly customerId: string;
  readonly asOf: UtcInstant;
  readonly currency: string;
  readonly positions: readonly PortfolioPositionRiskFact[];
  readonly instrumentProfiles: readonly InstrumentRiskProfile[];
  readonly reconciledEquity: readonly ReconciledEquityPoint[];
  readonly dailyLoss: DailyLossLedger;
  readonly strategyDrawdowns: readonly StrategyDrawdownFact[];
  readonly brokerageCashMinor: bigint;
  readonly unsettledEstimateMinor: bigint;
  readonly providerHealthy: boolean;
  readonly reconciliationOk: boolean;
  readonly customerPaused: boolean;
  readonly compliancePaused: boolean;
  readonly executionFailureCount: number;
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type RiskInterventionEvidence = {
  readonly interventionId: string;
  readonly mandateId: string;
  readonly portfolioId: string;
  readonly rule: string;
  readonly threshold: string;
  readonly observedValue: string;
  readonly observedAt: UtcInstant;
  readonly affectedStrategyId: string | null;
  readonly affectedInstrumentId: string | null;
  readonly resultingAction: RiskActionKind;
  readonly authority: string;
  readonly evidenceRefs: readonly string[];
  readonly trigger: KillControlTrigger | null;
  readonly policyVersion: RiskPolicyVersion;
  readonly priorState: PortfolioRiskState;
  readonly nextState: PortfolioRiskState;
};

export type PortfolioRiskStateRecord = {
  readonly mandateId: string;
  readonly portfolioId: string;
  readonly state: PortfolioRiskState;
  readonly activeTriggers: readonly KillControlTrigger[];
  readonly updatedAt: UtcInstant;
  readonly policyVersion: RiskPolicyVersion;
  readonly lastInterventionId: string | null;
  readonly customerPaused: boolean;
  readonly compliancePaused: boolean;
};

export type PortfolioExposureAssessment = {
  readonly grossExposureMinor: bigint;
  readonly netExposureMinor: bigint;
  readonly strategyExposures: readonly StrategyExposureFact[];
  readonly venueExposures: readonly VenueExposureFact[];
  readonly clusterExposures: readonly ClusterExposureFact[];
  readonly assetClassExposures: Readonly<Record<AssetClassTag, bigint>>;
  readonly portfolioDrawdown: Ratio | null;
  readonly liquidityMinor: bigint;
};

export type PortfolioRiskEvaluation = {
  readonly evaluationId: string;
  readonly mandateId: string;
  readonly portfolioId: string;
  readonly policyVersion: RiskPolicyVersion;
  readonly state: PortfolioRiskState;
  readonly priorState: PortfolioRiskState;
  readonly exposure: PortfolioExposureAssessment;
  readonly breachedRules: readonly string[];
  readonly recommendedActions: readonly RiskActionKind[];
  readonly newEntriesPermitted: boolean;
  readonly exitsPermitted: true;
  readonly emergencyClosePermitted: boolean;
  readonly intervention: RiskInterventionEvidence | null;
  readonly evaluatedAt: UtcInstant;
};

export type PortfolioRiskStoreSnapshot = {
  readonly policies: readonly MandateRiskPolicy[];
  readonly states: readonly PortfolioRiskStateRecord[];
  readonly interventions: readonly RiskInterventionEvidence[];
};
