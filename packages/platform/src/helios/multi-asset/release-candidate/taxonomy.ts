/**
 * HELIOS Multi-Asset Expansion M28 — forward-paper release candidate taxonomy.
 */

export const HELIOS_MULTI_ASSET_RELEASE_CANDIDATE_SCHEMA =
  'helios.multi-asset.release-candidate.v1' as const;

export const HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED =
  'HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED =
  'HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED' as const;

export const HELIOS_MULTI_ASSET_RELEASE_SEQUENCE = 'M01-M28' as const;
export const HELIOS_MULTI_ASSET_RELEASE_WORK_PACKAGE = 'M28' as const;

export const M28_TARGET_MARKETS = Object.freeze([
  'SPY',
  'QQQ',
  'BTC/USD',
  'ETH/USD',
  'Gold',
  'WTI/Oil',
] as const);

export type M28TargetMarket = (typeof M28_TARGET_MARKETS)[number];

export const M28_RELEASE_GATE_IDS = Object.freeze([
  'ARCHITECTURE',
  'TYPECHECK',
  'TEST_SUITE',
  'DATABASE_MIGRATIONS',
  'PERSISTENCE',
  'RESTART_SAFETY',
  'CUSTOMER_ISOLATION',
  'SECURITY',
  'PRODUCTION_SAFETY_FLAGS',
  'MARKET_DATA',
  'STRATEGIES',
  'PORTFOLIO_RISK',
  'EXECUTION_LIFECYCLE',
  'RECONCILIATION',
  'GROW_CONTRACT',
  'RESILIENCE',
  'FORWARD_PAPER',
  'EXTERNAL_PROVIDER_GATES',
  'LEGAL_REGULATORY_GATES',
  'LIVE_FINANCIAL_AUTHORIZATION',
] as const);

export type M28ReleaseGateId = (typeof M28_RELEASE_GATE_IDS)[number];

export type M28GateStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'BLOCKED' | 'OPEN' | 'CLOSED' | 'OFF';

export type M28ForwardPaperScenarioId =
  | 'M28-FP-01'
  | 'M28-FP-02'
  | 'M28-FP-03'
  | 'M28-FP-04'
  | 'M28-FP-05'
  | 'M28-FP-06'
  | 'M28-FP-07'
  | 'M28-FP-08'
  | 'M28-FP-09'
  | 'M28-FP-10'
  | 'M28-FP-11'
  | 'M28-FP-12'
  | 'M28-FP-13'
  | 'M28-FP-14'
  | 'M28-FP-15'
  | 'M28-FP-16'
  | 'M28-FP-17'
  | 'M28-FP-18'
  | 'M28-FP-19'
  | 'M28-FP-20'
  | 'M28-FP-21'
  | 'M28-FP-22'
  | 'M28-FP-23'
  | 'M28-FP-24'
  | 'M28-FP-25'
  | 'M28-FP-26'
  | 'M28-FP-27'
  | 'M28-FP-28'
  | 'M28-FP-29'
  | 'M28-FP-30'
  | 'M28-FP-31'
  | 'M28-FP-32'
  | 'M28-FP-33'
  | 'M28-FP-34'
  | 'M28-FP-35'
  | 'M28-FP-36'
  | 'M28-FP-37'
  | 'M28-FP-38'
  | 'M28-FP-39'
  | 'M28-FP-40';

export const M28_FORWARD_PAPER_SCENARIO_IDS: readonly M28ForwardPaperScenarioId[] = Object.freeze([
  'M28-FP-01',
  'M28-FP-02',
  'M28-FP-03',
  'M28-FP-04',
  'M28-FP-05',
  'M28-FP-06',
  'M28-FP-07',
  'M28-FP-08',
  'M28-FP-09',
  'M28-FP-10',
  'M28-FP-11',
  'M28-FP-12',
  'M28-FP-13',
  'M28-FP-14',
  'M28-FP-15',
  'M28-FP-16',
  'M28-FP-17',
  'M28-FP-18',
  'M28-FP-19',
  'M28-FP-20',
  'M28-FP-21',
  'M28-FP-22',
  'M28-FP-23',
  'M28-FP-24',
  'M28-FP-25',
  'M28-FP-26',
  'M28-FP-27',
  'M28-FP-28',
  'M28-FP-29',
  'M28-FP-30',
  'M28-FP-31',
  'M28-FP-32',
  'M28-FP-33',
  'M28-FP-34',
  'M28-FP-35',
  'M28-FP-36',
  'M28-FP-37',
  'M28-FP-38',
  'M28-FP-39',
  'M28-FP-40',
]);

export const M28_MILESTONE_IDS = Object.freeze([
  'M01',
  'M02',
  'M03',
  'M04',
  'M05',
  'M06',
  'M07',
  'M08',
  'M09',
  'M10',
  'M11',
  'M12',
  'M13',
  'M14',
  'M15',
  'M16',
  'M17',
  'M18',
  'M19',
  'M20',
  'M21',
  'M22',
  'M23',
  'M24',
  'M25',
  'M26',
  'M27',
  'M28',
] as const);

export type M28MilestoneId = (typeof M28_MILESTONE_IDS)[number];

export type M28MilestoneQualificationState = 'QUALIFIED' | 'PARTIAL' | 'BLOCKED' | 'NOT_STARTED';
