export {
  HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA,
  HELIOS_ALPHA24_WORK_PACKAGE,
  HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED,
  HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED,
  FORWARD_STRATEGY_LIFECYCLE_STATES,
  FORWARD_CAMPAIGN_STATES,
  RESEARCH_BOOK_REPORT_KINDS,
  type ForwardStrategyLifecycleState,
  type ForwardCampaignState,
  type ResearchBookReportKind,
} from './taxonomy.ts';

export type {
  ForwardCampaignRecord,
  ForwardStrategyResearchRecord,
  ForwardResearchOperationalSnapshot,
  ForwardResearchBookInput,
  DailyForwardResearchBook,
  DailyForwardResearchBookSection,
  StrategyDailyOutcomeRow,
  WeeklyForwardResearchBook,
  WeeklyForwardResearchBookSection,
  StrategyWeeklyPerformanceRow,
  RegimePerformanceRow,
  StrategyRankRow,
  ChallengerStatusRow,
  CampaignEvidenceDigest,
  StrategyEvidenceCard,
  PortfolioEvidenceCard,
  ResearchSurvivorshipAudit,
  Alpha24ResearchBookBundle,
} from './types.ts';

export { isLoserStrategy, isSurvivingStrategy, isRetiredStrategy, activeStrategies } from './stats.ts';
export { checkLosersInclusion, type LosersInclusionCheck } from './losers-policy.ts';
export { buildResearchSurvivorshipAudit } from './survivorship.ts';
export { buildDailyForwardResearchBook } from './daily-book.ts';
export { buildWeeklyForwardResearchBook } from './weekly-book.ts';
export {
  buildCampaignEvidenceDigest,
  buildStrategyEvidenceCard,
  buildPortfolioEvidenceCard,
  buildAllCampaignDigests,
  buildAllStrategyCards,
} from './cards.ts';
export { runAlpha24ForwardResearchBookPipeline } from './pipeline.ts';
export {
  evaluateAlpha24ResearchBookQualification,
  alpha24ResearchBookMarker,
  type Alpha24QualificationResult,
} from './qualification.ts';
export { alpha24MixedUniverseFixture, alpha24WinnersOnlyInputFixture } from './fixtures.ts';
