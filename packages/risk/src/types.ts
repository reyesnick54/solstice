import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { ModelId, ModelVersion } from '../../model-registry/src/ids.ts';
import type { Ratio } from './arithmetic.ts';
import type {
  PortfolioRiskSnapshotId,
  PreTradeRiskDecisionId,
  RiskAssessmentId,
  RiskBudgetId,
  RiskLimitId,
  RiskModelId,
  RiskModelVersion,
  RiskPolicyVersion,
  StressRunId,
  StressScenarioId,
} from './ids.ts';

export const RISK_DIMENSIONS = [
  'POSITION_SIZE',
  'PORTFOLIO_CONCENTRATION',
  'INSTRUMENT_CONCENTRATION',
  'ASSET_CLASS_CONCENTRATION',
  'CURRENCY_EXPOSURE',
  'LIQUIDITY',
  'MARKET_DATA_FRESHNESS',
  'CASH_RESERVE',
  'MANDATE_ALIGNMENT',
  'LOSS_BUDGET',
  'DRAWDOWN',
  'VOLATILITY',
  'TURNOVER',
  'SETTLEMENT_EXPOSURE',
] as const;

export type RiskDimension = (typeof RISK_DIMENSIONS)[number];

export const RISK_OUTCOMES = ['ALLOW_SIMULATION', 'REQUIRE_REVIEW', 'BLOCK', 'INSUFFICIENT_DATA'] as const;
export type RiskOutcome = (typeof RISK_OUTCOMES)[number];

export const MARKET_DATA_QUALITY = ['CURRENT', 'STALE', 'MISSING', 'CONFLICTED'] as const;
export type MarketDataQuality = (typeof MARKET_DATA_QUALITY)[number];

export const LIQUIDITY_CLASSES = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
export type LiquidityClass = (typeof LIQUIDITY_CLASSES)[number];

export const STALE_DATA_POLICIES = ['REQUIRE_REVIEW', 'BLOCK', 'INSUFFICIENT_DATA'] as const;
export type StaleDataPolicy = (typeof STALE_DATA_POLICIES)[number];

export const RISK_LIMIT_PRIORITIES = [
  'STRUCTURAL_IMPOSSIBILITY',
  'POLICY_COMPLIANCE_PROHIBITION',
  'HARD_MANDATE_CONSTRAINT',
  'HARD_RISK_LIMIT',
  'PORTFOLIO_PREFERENCE',
  'OPTIMIZATION_PREFERENCE',
] as const;

export type RiskLimitPriority = (typeof RISK_LIMIT_PRIORITIES)[number];

export const STRESS_SCENARIO_KINDS = [
  'EQUITY_SHOCK_NEGATIVE_10',
  'EQUITY_SHOCK_NEGATIVE_20',
  'FX_SHOCK',
  'LIQUIDITY_REDUCTION',
  'CORRELATED_ASSET_SHOCK',
] as const;

export type StressScenarioKind = (typeof STRESS_SCENARIO_KINDS)[number];

export type MandateLiquidityConstraint = {
  readonly kind: 'MINIMUM_CASH_RESERVE' | 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR' | 'KEEP_ALL_LIQUID';
  readonly minimumLiquidMinor: bigint;
  readonly currency: string;
  readonly overrideForbidden: true;
  readonly sourceRef: string;
};

export type RiskLimit = {
  readonly limitId: RiskLimitId;
  readonly dimension: RiskDimension;
  readonly priority: RiskLimitPriority;
  readonly maxRatio?: Ratio;
  readonly minCashMinor?: bigint;
  readonly maxLossMinor?: bigint;
  readonly allowedCurrencies?: readonly string[];
  readonly permittedInstrumentClasses?: readonly string[];
  readonly engineeringOnly: true;
  readonly regulatoryRequirement: false;
};

export type RiskBudget = {
  readonly budgetId: RiskBudgetId;
  readonly subjectId: string;
  readonly portfolioId: string;
  readonly version: RiskPolicyVersion;
  readonly permittedInstrumentClasses: readonly string[];
  readonly maximumInstrumentConcentration: Ratio;
  readonly maximumAssetClassConcentration: Ratio;
  readonly maximumCurrencyConcentration: Ratio;
  readonly maximumPortfolioDeployment: Ratio;
  readonly minimumBrokerageCashMinor: bigint;
  readonly drawdownGuard: Ratio;
  readonly maximumSimulatedStressLossMinor: bigint;
  readonly allowedCurrencies: readonly string[];
  readonly reviewBy: UtcInstant;
  readonly engineeringOnly: true;
  readonly cannotLoosenMandate: true;
};

export type ProposedPaperTrade = {
  readonly proposalRef: string;
  readonly instrumentId: string;
  readonly instrumentType: string;
  readonly currency: string;
  readonly issuerCategory?: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: bigint;
  readonly quantityScale: 8;
  readonly priceMinor: bigint;
  readonly notionalMinor: bigint;
  readonly feeMinor: bigint;
  readonly liquidityClass: LiquidityClass;
};

export type RiskPositionFact = {
  readonly instrumentId: string;
  readonly instrumentType: string;
  readonly currency: string;
  readonly issuerCategory?: string;
  readonly quantityUnits: bigint;
  readonly marketValueMinor: bigint;
  readonly priceMinor: bigint;
  readonly priceTimestamp: UtcInstant;
  readonly priceQuality: MarketDataQuality;
  readonly liquidityClass: LiquidityClass;
  readonly sourceRef: string;
};

export type ValuationObservation = {
  readonly at: UtcInstant;
  readonly portfolioMarketValueMinor: bigint;
  readonly currency: string;
};

export type PortfolioRiskSnapshot = {
  readonly snapshotId: PortfolioRiskSnapshotId;
  readonly portfolioId: string;
  readonly subjectId: string;
  readonly asOf: UtcInstant;
  readonly currency: string;
  readonly positions: readonly RiskPositionFact[];
  readonly brokerageCashMinor: bigint;
  readonly unsettledCashMinor: bigint;
  readonly pendingOrderNotionalMinor: bigint;
  readonly realizedPnlMinor: bigint;
  readonly unrealizedPnlMinor: bigint;
  readonly mandate?: MandateLiquidityConstraint;
  readonly observations: readonly ValuationObservation[];
  readonly sourceRefs: readonly string[];
  readonly simulationOnly: true;
};

export type TriggeredLimit = {
  readonly limitId: RiskLimitId;
  readonly dimension: RiskDimension;
  readonly priority: RiskLimitPriority;
  readonly message: string;
  readonly observedRatio?: Ratio;
  readonly limitRatio?: Ratio;
  readonly observedMinor?: bigint;
  readonly limitMinor?: bigint;
};

export type RiskCalculation = {
  readonly name: string;
  readonly dimension: RiskDimension;
  readonly inputs: readonly string[];
  readonly resultRatio?: Ratio;
  readonly resultMinor?: bigint;
  readonly method: string;
  readonly precision: 'RATIO_SCALE_8' | 'MONEY_MINOR_UNITS' | 'INSUFFICIENT_DATA';
};

export type RiskDecision = {
  readonly assessmentId: RiskAssessmentId;
  readonly decisionId: PreTradeRiskDecisionId;
  readonly snapshotId: PortfolioRiskSnapshotId;
  readonly proposedActionRef: string;
  readonly modelId: RiskModelId | ModelId;
  readonly modelVersion: RiskModelVersion | ModelVersion;
  readonly policyVersion: RiskPolicyVersion;
  readonly outcome: RiskOutcome;
  readonly triggeredLimits: readonly TriggeredLimit[];
  readonly calculations: readonly RiskCalculation[];
  readonly sourceFacts: readonly string[];
  readonly staleOrMissingFacts: readonly string[];
  readonly generatedAt: UtcInstant;
  readonly guaranteedOutcome: false;
};

export type StressScenario = {
  readonly scenarioId: StressScenarioId;
  readonly kind: StressScenarioKind;
  readonly version: string;
  readonly shockRatio: Ratio;
  readonly assumptions: readonly string[];
  readonly source: 'ENGINEERING_FIXTURE';
  readonly status: 'ACTIVE_SIMULATION';
  readonly predictiveClaim: false;
};

export type StressRun = {
  readonly runId: StressRunId;
  readonly scenarioId: StressScenarioId;
  readonly snapshotId: PortfolioRiskSnapshotId;
  readonly estimatedLossMinor: bigint;
  readonly stressedPortfolioMinor: bigint;
  readonly breachedLimits: readonly TriggeredLimit[];
  readonly generatedAt: UtcInstant;
  readonly mutatesFinancialState: false;
  readonly placesOrders: false;
};

export type ExtremeGoalAnalysis = {
  readonly preservedGoal: string;
  readonly baselineMinor: bigint;
  readonly targetMinor: bigint;
  readonly intervalDays: bigint;
  readonly impliedGrowth: Ratio;
  readonly guaranteed: false;
  readonly limitsRelaxed: false;
  readonly compatibleWithCurrentLimits: boolean;
  readonly uncertaintyNotes: readonly string[];
};

export type InvestmentRiskKernelFacts = {
  readonly assessmentId: string;
  readonly outcome: RiskOutcome;
  readonly triggeredLimitIds: readonly string[];
  readonly modelId: string;
  readonly modelVersion: string;
  readonly generatedAt: string;
};

export type GrowthRiskAnnotation = {
  readonly candidateRef: string;
  readonly compatible: boolean;
  readonly outcome: RiskOutcome;
  readonly reason: string;
};

export type PeveRiskContext = {
  readonly assessmentId: string;
  readonly outcome: RiskOutcome;
  readonly higherRiskIsNotHigherValue: true;
  readonly unrealizedUpsideIsNotRealizedValue: true;
};

export type RdtRiskPreview = {
  readonly wouldLoosenCurrentLimits: boolean;
  readonly applied: false;
  readonly notes: readonly string[];
};

export type RiskStoreSnapshot = {
  readonly budgets: readonly RiskBudget[];
  readonly limits: readonly RiskLimit[];
  readonly snapshots: readonly PortfolioRiskSnapshot[];
  readonly assessments: readonly RiskDecision[];
  readonly scenarios: readonly StressScenario[];
  readonly runs: readonly StressRun[];
};
