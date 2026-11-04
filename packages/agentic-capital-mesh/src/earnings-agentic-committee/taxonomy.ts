export const EARNINGS_COMMITTEE_SCHEMA = 'sunrey.helios.earn10.agentic-earnings-committee.v1' as const;

export const HELIOS_EARN10_AGENTIC_COMMITTEE = 'HELIOS_EARN10_AGENTIC_EARNINGS_COMMITTEE' as const;
export const HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED =
  'HELIOS_EARN10_AGENTIC_COMMITTEE_QUALIFIED' as const;
export const HELIOS_EARN10_AGENTIC_COMMITTEE_BLOCKED =
  'HELIOS_EARN10_AGENTIC_COMMITTEE_BLOCKED' as const;

/** Independent analyst specialists (run before advocacy). */
export const EARNINGS_ANALYST_SPECIALIST_ROLES = [
  'HARD_FINANCIALS',
  'ANALYST_EXPECTATIONS',
  'TRANSCRIPT_INTELLIGENCE',
  'EARNINGS_QUALITY',
  'OPTIONS_EARNINGS',
  'PEER_READ_THROUGH',
  'MACRO_CONTEXT',
] as const;

export type EarningsAnalystSpecialistRole = (typeof EARNINGS_ANALYST_SPECIALIST_ROLES)[number];

export const EARNINGS_ADVOCACY_ROLES = ['BULL_EARNINGS', 'BEAR_EARNINGS'] as const;
export type EarningsAdvocacyRole = (typeof EARNINGS_ADVOCACY_ROLES)[number];

export const EARNINGS_REVIEW_ROLES = ['FORENSIC_ACCOUNTING', 'RISK_EARNINGS'] as const;
export type EarningsReviewRole = (typeof EARNINGS_REVIEW_ROLES)[number];

export const EARNINGS_COMMITTEE_ROLES = [
  ...EARNINGS_ANALYST_SPECIALIST_ROLES,
  ...EARNINGS_ADVOCACY_ROLES,
  ...EARNINGS_REVIEW_ROLES,
  'EARNINGS_SYNTHESIS',
] as const;

export type EarningsCommitteeRole = (typeof EARNINGS_COMMITTEE_ROLES)[number];

export const EARNINGS_COMMITTEE_PHASES = [
  'EVIDENCE_FREEZE',
  'PROBABILISTIC_STATE',
  'H20_SPECIALIST_ASSIGNMENT',
  'SPECIALIST_ANALYSIS',
  'ADVOCACY_DEBATE',
  'FORENSIC_REVIEW',
  'RISK_REVIEW',
  'CONTRADICTION_CHALLENGE',
  'SYNTHESIS',
] as const;

export type EarningsCommitteePhase = (typeof EARNINGS_COMMITTEE_PHASES)[number];

export const EARNINGS_TIME_HORIZONS = [
  'PRE_EARNINGS',
  'EARNINGS_WINDOW',
  'POST_EARNINGS_1W',
  'POST_EARNINGS_1M',
  'QUARTER_AHEAD',
] as const;

export type EarningsTimeHorizon = (typeof EARNINGS_TIME_HORIZONS)[number];

export const EARNINGS_COMMITTEE_AGENT_NAMES: Readonly<Record<EarningsCommitteeRole, string>> =
  Object.freeze({
    HARD_FINANCIALS: 'HardFinancialsAgent',
    ANALYST_EXPECTATIONS: 'AnalystExpectationsAgent',
    TRANSCRIPT_INTELLIGENCE: 'TranscriptIntelligenceAgent',
    EARNINGS_QUALITY: 'EarningsQualityAgent',
    OPTIONS_EARNINGS: 'OptionsEarningsAgent',
    PEER_READ_THROUGH: 'PeerReadThroughAgent',
    MACRO_CONTEXT: 'MacroContextAgent',
    BULL_EARNINGS: 'BullEarningsAgent',
    BEAR_EARNINGS: 'BearEarningsAgent',
    FORENSIC_ACCOUNTING: 'ForensicAccountingAgent',
    RISK_EARNINGS: 'RiskEarningsAgent',
    EARNINGS_SYNTHESIS: 'EarningsSynthesisAgent',
  });
