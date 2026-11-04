/**
 * HELIOS earnings intelligence taxonomy — EARN01 canonical domain + EARN02–EARN12 stack.
 */

export const HELIOS_EARNINGS_INTELLIGENCE_SCHEMA = 'helios.earnings-intelligence.v1' as const;

/** EARN01 point-in-time canonical observation schema (distinct from stack schema). */
export const HELIOS_EARN01_CANONICAL_DOMAIN_SCHEMA =
  'sunrey.helios.earn01.earnings-intelligence.v1' as const;

export const HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/earnings-intelligence' as const;

export const HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED =
  'HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED' as const;
export const HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED =
  'HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED' as const;

export const HELIOS_EARN01_DOMAIN_QUALIFIED = 'HELIOS_EARN01_DOMAIN_QUALIFIED' as const;
export const HELIOS_EARN01_DOMAIN_BLOCKED = 'HELIOS_EARN01_DOMAIN_BLOCKED' as const;

export const EARNINGS_ANNOUNCEMENT_STATES = [
  'EXPECTED',
  'CONFIRMED',
  'RELEASED',
  'CALL_SCHEDULED',
  'CALL_COMPLETED',
  'AMENDED',
  'CANCELLED',
  'UNKNOWN',
] as const;
export type EarningsAnnouncementState = (typeof EARNINGS_ANNOUNCEMENT_STATES)[number];

export const EARNINGS_SESSION_CLASSIFICATIONS = [
  'BEFORE_MARKET',
  'DURING_MARKET',
  'AFTER_MARKET',
  'NON_TRADING_DAY',
  'UNKNOWN',
] as const;
export type EarningsSessionClassification = (typeof EARNINGS_SESSION_CLASSIFICATIONS)[number];

export const EARNINGS_OBSERVATION_KINDS = [
  'release',
  'actual',
  'expectation',
  'consensus',
  'guidance',
  'transcript',
  'options',
  'market_reaction',
  'peer_context',
] as const;
export type EarningsObservationKind = (typeof EARNINGS_OBSERVATION_KINDS)[number];

export const EARN_WORK_PACKAGES = [
  'EARN01',
  'EARN02',
  'EARN03',
  'EARN04',
  'EARN05',
  'EARN06',
  'EARN07',
  'EARN08',
  'EARN09',
  'EARN10',
  'EARN11',
  'EARN12',
] as const;

export type EarnWorkPackageId = (typeof EARN_WORK_PACKAGES)[number];

export const EARNINGS_BENCHMARK_STRATEGIES = [
  'NAIVE_SEASONAL_EARNINGS',
  'ROBUST_CONSENSUS',
  'LAST_QUARTER',
  'CONSENSUS_ONLY',
  'FUNDAMENTALS_ONLY',
  'TRANSCRIPT_ONLY',
  'OPTIONS_ONLY',
  'FULL_ENSEMBLE',
  'HELIOS_FULL_STACK',
] as const;

export type EarningsBenchmarkStrategy = (typeof EARNINGS_BENCHMARK_STRATEGIES)[number];

export const EARNINGS_REALITY_GATE_STATUSES = [
  'ARCHITECTURALLY_QUALIFIED',
  'FORECASTING_QUALIFIED',
  'PAPER_ALPHA_CANDIDATE',
  'FORWARD_ALPHA_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
] as const;

export type EarningsRealityGateStatus = (typeof EARNINGS_REALITY_GATE_STATUSES)[number];

export const EARNINGS_REGIME_SLICES = [
  'LARGE_CAP',
  'MID_CAP',
  'SMALL_CAP',
  'HIGH_ANALYST_COVERAGE',
  'LOW_ANALYST_COVERAGE',
  'HIGH_LIQUIDITY',
  'LOW_LIQUIDITY',
  'BULL',
  'BEAR',
  'HIGH_VOLATILITY',
  'LOW_VOLATILITY',
  'SECTOR',
  'PRE_MAJOR_REGIME',
  'POST_MAJOR_REGIME',
] as const;

export type EarningsRegimeSlice = (typeof EARNINGS_REGIME_SLICES)[number];

export const MINIMUM_HOLDOUT_EVENTS_FOR_FORECASTING = 12;
export const MINIMUM_SAMPLE_FOR_RETURN_SIGNIFICANCE = 30;
export const EVENT_EMBARGO_DAYS = 5;
