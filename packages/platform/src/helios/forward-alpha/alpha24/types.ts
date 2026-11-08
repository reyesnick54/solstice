import type { UtcInstant } from '@solstice/domain';

import type {
  FORWARD_CAMPAIGN_STATES,
  FORWARD_STRATEGY_LIFECYCLE_STATES,
  HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
} from './taxonomy.ts';

export type ForwardCampaignRecord = {
  readonly campaignId: string;
  readonly startedAt: UtcInstant;
  readonly terminatedAt: UtcInstant | null;
  readonly state: (typeof FORWARD_CAMPAIGN_STATES)[number];
  readonly opportunityCount: number;
};

export type ForwardStrategyResearchRecord = {
  readonly strategyId: string;
  readonly campaignId: string;
  readonly genomeId: string;
  readonly lifecycle: (typeof FORWARD_STRATEGY_LIFECYCLE_STATES)[number];
  readonly registeredAt: UtcInstant;
  readonly retiredAt: UtcInstant | null;
  /** Cumulative paper PnL (minor units, signed). */
  readonly cumulativePnLMinor: bigint;
  /** Benchmark-relative cumulative active return (basis points, signed). */
  readonly benchmarkRelativeBps: number;
  readonly maxDrawdownBps: number;
  readonly paperTradeCount: number;
  readonly executionQualityScoreBps: number;
  readonly outcomeMaturityDays: number;
  readonly regimeTags: readonly string[];
  readonly capacityUtilizationBps: number;
  readonly alphaDecayBps: number;
  readonly executionDecayBps: number;
  readonly sequentialEvidenceState: string;
  readonly multipleTestingBucket: string;
  readonly dataQualityIssueCount: number;
  readonly unresolvedConcernCount: number;
  readonly isChallenger: boolean;
  readonly rankOrdinal: number | null;
};

export type ForwardResearchOperationalSnapshot = {
  readonly asOf: UtcInstant;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly marketConditionsSummary: string;
  readonly marketRegimeTag: string;
  readonly newDecisionCount: number;
  readonly incidentCount: number;
  readonly portfolioCumulativePnLMinor: bigint;
  readonly portfolioBenchmarkRelativeBps: number;
  readonly portfolioMaxDrawdownBps: number;
  readonly riskMetricVolatilityBps: number;
  readonly riskMetricTailLossBps: number;
  readonly multipleTestingStateSummary: string;
  readonly sequentialEvidenceSummary: string;
};

export type ForwardResearchBookInput = {
  readonly campaigns: readonly ForwardCampaignRecord[];
  readonly strategies: readonly ForwardStrategyResearchRecord[];
  readonly operations: ForwardResearchOperationalSnapshot;
  /** Optional non-canonical narrative; deterministic fields remain authoritative. */
  readonly aiNarrativeDraft?: string | null;
};

export type DailyForwardResearchBookSection = {
  readonly marketConditions: string;
  readonly activeStrategyCount: number;
  readonly newDecisions: number;
  readonly paperTrades: number;
  readonly executionQualitySummaryBps: number;
  readonly pnlMinor: bigint;
  readonly benchmarkRelativeBps: number;
  readonly drawdownBps: number;
  readonly outcomeMaturitySummary: string;
  readonly incidents: number;
  readonly demotions: readonly string[];
  readonly dataQualityIssues: number;
  readonly strategyOutcomes: readonly StrategyDailyOutcomeRow[];
  readonly losersIncluded: boolean;
  readonly winnersOnlyBlocked: boolean;
};

export type StrategyDailyOutcomeRow = {
  readonly strategyId: string;
  readonly lifecycle: string;
  readonly pnlMinor: bigint;
  readonly benchmarkRelativeBps: number;
  readonly isLoser: boolean;
};

export type DailyForwardResearchBook = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'DAILY_FORWARD_RESEARCH_BOOK';
  readonly bookId: string;
  readonly asOf: UtcInstant;
  readonly section: DailyForwardResearchBookSection;
  readonly aiNarrative: string | null;
};

export type WeeklyForwardResearchBookSection = {
  readonly campaignAgeSummary: string;
  readonly opportunityCount: number;
  readonly strategyPerformanceRows: readonly StrategyWeeklyPerformanceRow[];
  readonly portfolioPnLMinor: bigint;
  readonly portfolioBenchmarkRelativeBps: number;
  readonly riskVolatilityBps: number;
  readonly riskTailLossBps: number;
  readonly regimePerformance: readonly RegimePerformanceRow[];
  readonly sequentialEvidence: string;
  readonly multipleTestingState: string;
  readonly capacitySummary: string;
  readonly executionDecayBps: number;
  readonly alphaDecayBps: number;
  readonly strategyRanking: readonly StrategyRankRow[];
  readonly challengerStatus: readonly ChallengerStatusRow[];
  readonly unresolvedConcerns: number;
  readonly losersIncluded: boolean;
  readonly winnersOnlyBlocked: boolean;
};

export type StrategyWeeklyPerformanceRow = {
  readonly strategyId: string;
  readonly lifecycle: string;
  readonly pnlMinor: bigint;
  readonly benchmarkRelativeBps: number;
  readonly isLoser: boolean;
};

export type RegimePerformanceRow = {
  readonly regimeTag: string;
  readonly strategyCount: number;
  readonly aggregateBenchmarkRelativeBps: number;
};

export type StrategyRankRow = {
  readonly strategyId: string;
  readonly rank: number;
  readonly benchmarkRelativeBps: number;
};

export type ChallengerStatusRow = {
  readonly strategyId: string;
  readonly status: 'CHALLENGER_ACTIVE' | 'CHALLENGER_RETIRED' | 'NOT_CHALLENGER';
};

export type WeeklyForwardResearchBook = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'WEEKLY_FORWARD_RESEARCH_BOOK';
  readonly bookId: string;
  readonly asOf: UtcInstant;
  readonly weekStart: UtcInstant;
  readonly weekEnd: UtcInstant;
  readonly section: WeeklyForwardResearchBookSection;
  readonly aiNarrative: string | null;
};

export type CampaignEvidenceDigest = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'CAMPAIGN_EVIDENCE_DIGEST';
  readonly digestId: string;
  readonly campaignId: string;
  readonly startedAt: UtcInstant;
  readonly terminatedAt: UtcInstant | null;
  readonly state: string;
  readonly opportunityCount: number;
  readonly strategiesTested: number;
  readonly strategiesSurviving: number;
  readonly strategiesRetired: number;
  readonly loserStrategyIds: readonly string[];
  readonly winnerStrategyIds: readonly string[];
};

export type StrategyEvidenceCard = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'STRATEGY_EVIDENCE_CARD';
  readonly cardId: string;
  readonly strategy: ForwardStrategyResearchRecord;
  readonly isLoser: boolean;
  readonly includedInCumulativeHistory: boolean;
};

export type PortfolioEvidenceCard = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'PORTFOLIO_EVIDENCE_CARD';
  readonly cardId: string;
  readonly asOf: UtcInstant;
  readonly activeStrategyCount: number;
  readonly cumulativeHistoryStrategyCount: number;
  readonly portfolioPnLMinor: bigint;
  readonly portfolioBenchmarkRelativeBps: number;
  readonly portfolioMaxDrawdownBps: number;
  readonly loserStrategyIds: readonly string[];
  readonly retiredStrategyIds: readonly string[];
};

export type ResearchSurvivorshipAudit = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly kind: 'RESEARCH_SURVIVORSHIP_AUDIT';
  readonly auditId: string;
  readonly computedAt: UtcInstant;
  readonly campaignsStarted: readonly string[];
  readonly campaignsTerminated: readonly string[];
  readonly strategiesTested: readonly string[];
  readonly strategiesSurviving: readonly string[];
  readonly strategiesRetired: readonly string[];
  readonly losersInUniverse: readonly string[];
};

export type Alpha24ResearchBookBundle = {
  readonly schema: typeof HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA;
  readonly survivorshipAudit: ResearchSurvivorshipAudit;
  readonly dailyBook: DailyForwardResearchBook;
  readonly weeklyBook: WeeklyForwardResearchBook;
  readonly campaignDigests: readonly CampaignEvidenceDigest[];
  readonly strategyCards: readonly StrategyEvidenceCard[];
  readonly portfolioCard: PortfolioEvidenceCard;
};
