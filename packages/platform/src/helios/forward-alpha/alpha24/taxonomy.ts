/**
 * HELIOS FORWARD ALPHA — ALPHA24 automated forward research book and evidence reporting.
 */

export const HELIOS_ALPHA24_RESEARCH_BOOK_SCHEMA = 'sunrey.helios.forward-alpha.alpha24.v1' as const;

export const HELIOS_ALPHA24_WORK_PACKAGE = 'ALPHA24' as const;

export const HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED = 'HELIOS_ALPHA24_RESEARCH_BOOK_QUALIFIED' as const;

export const HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED = 'HELIOS_ALPHA24_RESEARCH_BOOK_BLOCKED' as const;

export const FORWARD_STRATEGY_LIFECYCLE_STATES = Object.freeze([
  'ACTIVE',
  'CHALLENGER',
  'SURVIVING',
  'DEMOTED',
  'RETIRED',
  'TERMINATED',
] as const);

export type ForwardStrategyLifecycleState = (typeof FORWARD_STRATEGY_LIFECYCLE_STATES)[number];

export const FORWARD_CAMPAIGN_STATES = Object.freeze([
  'ACTIVE',
  'PAUSED',
  'TERMINATED',
  'COMPLETE',
] as const);

export type ForwardCampaignState = (typeof FORWARD_CAMPAIGN_STATES)[number];

export const RESEARCH_BOOK_REPORT_KINDS = Object.freeze([
  'DAILY_FORWARD_RESEARCH_BOOK',
  'WEEKLY_FORWARD_RESEARCH_BOOK',
  'CAMPAIGN_EVIDENCE_DIGEST',
  'STRATEGY_EVIDENCE_CARD',
  'PORTFOLIO_EVIDENCE_CARD',
  'RESEARCH_SURVIVORSHIP_AUDIT',
] as const);

export type ResearchBookReportKind = (typeof RESEARCH_BOOK_REPORT_KINDS)[number];
