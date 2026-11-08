import type {
  ALPHA_BREADTH_CLASSIFICATIONS,
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA,
  StrategyInteractionKind,
} from './taxonomy.ts';

/** One strategy admitted into a shared-capital forward portfolio. */
export type ForwardStrategyLeg = {
  readonly strategyId: string;
  readonly strategyVersion: string;
  /** Period return on that strategy's allocated sleeve (integer basis points). */
  readonly periodReturnBps: number;
  /** Active return vs benchmark on the sleeve (basis points). */
  readonly activeReturnBps: number;
  /**
   * Standalone claimed alpha before portfolio overlap adjustment (basis points).
   * Engine rejects when naive sum would double-count overlapping economic exposure.
   */
  readonly standaloneAlphaBps: number;
  /** Return series aligned across legs; length must match sibling legs. */
  readonly returnSeriesBps: readonly number[];
  readonly positions: readonly StrategyPositionLeg[];
  readonly factorExposureBps: Readonly<Record<string, number>>;
  readonly maxDrawdownBps: number;
  readonly riskLimitUtilizationBps: number;
};

export type StrategyPositionLeg = {
  readonly instrumentId: string;
  /** Signed notional weight of this leg's sleeve in basis points of strategy capital (can be negative). */
  readonly weightBps: number;
  readonly sectorId: string;
};

/** Portfolio definition: many strategies, one capital pool. */
export type ForwardStrategyPortfolio = {
  readonly schema: typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA;
  readonly portfolioId: string;
  readonly totalCapitalMinor: string;
  readonly legs: readonly ForwardStrategyLeg[];
};

/** Shared capital weights; capital is counted once. */
export type PortfolioCapitalAllocation = {
  readonly portfolioId: string;
  readonly totalCapitalMinor: string;
  readonly cashMinor: string;
  readonly deployments: readonly StrategyCapitalDeployment[];
  /** Sum of deployment weights must equal 10_000 when fully invested policy applies. */
  readonly deploymentWeightBpsTotal: number;
  readonly capitalConserved: boolean;
};

export type StrategyCapitalDeployment = {
  readonly strategyId: string;
  readonly weightBps: number;
  readonly allocatedCapitalMinor: string;
};

export type CombinedInstrumentExposure = {
  readonly instrumentId: string;
  readonly contributingStrategies: readonly string[];
  /** Net signed weight as bps of total portfolio capital. */
  readonly netWeightBps: number;
  readonly grossWeightBps: number;
};

export type StrategyInteractionRecord = {
  readonly interactionId: string;
  readonly kind: StrategyInteractionKind;
  readonly strategyIds: readonly string[];
  readonly instrumentId?: string;
  readonly detail: string;
  /** Severity 0–10_000; higher means more portfolio interaction risk. */
  readonly severityBps: number;
};

export type StrategyInteractionState = {
  readonly portfolioId: string;
  readonly combinedExposures: readonly CombinedInstrumentExposure[];
  readonly interactions: readonly StrategyInteractionRecord[];
  readonly pairwiseReturnCorrelationScale: Readonly<Record<string, number>>;
  readonly duplicateAlphaExposureBps: number;
  readonly executionCompetitionScoreBps: number;
};

export type StrategyAttributionSlice = {
  readonly strategyId: string;
  readonly returnContributionBps: number;
  readonly activeContributionBps: number;
  /** Alpha credited after overlap deduplication (basis points of portfolio). */
  readonly alphaContributionBps: number;
  readonly marginalRiskContributionBps: number;
  readonly diversificationContributionBps: number;
};

export type PortfolioForwardEvidence = {
  readonly schema: typeof HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA;
  readonly portfolioId: string;
  readonly allocation: PortfolioCapitalAllocation;
  readonly interaction: StrategyInteractionState;
  readonly portfolioReturnBps: number;
  readonly activeReturnBps: number;
  readonly riskAdjustedReturnBps: number;
  readonly maxDrawdownBps: number;
  readonly factorExposureBps: Readonly<Record<string, number>>;
  readonly strategyContributions: readonly StrategyAttributionSlice[];
  readonly alphaBreadth: AlphaBreadth;
  readonly naiveAlphaSumBps: number;
  readonly deduplicatedAlphaBps: number;
  readonly alphaDoubleCountBlockedBps: number;
  readonly capitalDoubleCountDetected: boolean;
};

export type AlphaBreadth = {
  readonly strategyCount: number;
  readonly independentEdgeClusterCount: number;
  readonly averagePairwiseCorrelationScale: number;
  readonly classification: (typeof ALPHA_BREADTH_CLASSIFICATIONS)[number];
  readonly breadthScoreBps: number;
  readonly correlatedExpressionBps: number;
};
