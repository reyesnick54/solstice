/**
 * HELIOS forward-alpha evidence program taxonomy (ALPHA01–ALPHA15).
 */

export const HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA = 'helios.forward-alpha-evidence.v1' as const;

export const HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED =
  'HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED' as const;

export const HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED =
  'HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED' as const;

export const ALPHA_WORK_PACKAGES = Object.freeze([
  'ALPHA01',
  'ALPHA02',
  'ALPHA03',
  'ALPHA04',
  'ALPHA05',
  'ALPHA06',
  'ALPHA07',
  'ALPHA08',
  'ALPHA09',
  'ALPHA10',
  'ALPHA11',
  'ALPHA12',
  'ALPHA13',
  'ALPHA14',
  'ALPHA15',
] as const);

export type AlphaWorkPackageId = (typeof ALPHA_WORK_PACKAGES)[number];

/** Evidence-derived status ladder (distinct from architecture qualification marker). */
export const FORWARD_ALPHA_REALITY_STATUSES = Object.freeze([
  'ARCHITECTURE_QUALIFIED',
  'FORWARD_CAMPAIGN_READY',
  'FORWARD_EVIDENCE_ACCUMULATING',
  'FORWARD_EDGE_CANDIDATE',
  'FORWARD_ALPHA_SUPPORTED',
  'FORWARD_ROBUSTNESS_SUPPORTED',
  'PAPER_IMPLEMENTATION_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
] as const);

export type ForwardAlphaRealityStatus = (typeof FORWARD_ALPHA_REALITY_STATUSES)[number];

export const INVESTMENT_PERFORMANCE_PROOF_STATUSES = Object.freeze([
  'FORWARD_ALPHA_SUPPORTED',
  'FORWARD_ROBUSTNESS_SUPPORTED',
  'PAPER_IMPLEMENTATION_SUPPORTED',
  'LIVE_ALPHA_SUPPORTED',
] as const);

export type InvestmentPerformanceProofStatus = (typeof INVESTMENT_PERFORMANCE_PROOF_STATUSES)[number];

export const FORWARD_EVIDENCE_PROVENANCE = Object.freeze([
  'NONE',
  'SYNTHETIC',
  'HISTORICAL_FIXTURE',
  'CHRONOLOGICAL_FORWARD',
  'REGULATED_LIVE',
] as const);

export type ForwardEvidenceProvenance = (typeof FORWARD_EVIDENCE_PROVENANCE)[number];

export const ALPHA_EVIDENCE_SOURCE_KINDS = Object.freeze([
  'ARCHITECTURE_ONLY',
  'SYNTHETIC_HARNESS',
  'HISTORICAL_FIXTURE',
  'GENUINE_FORWARD_CAMPAIGN',
  'REGULATED_LIVE_CAPITAL',
] as const);

export type AlphaEvidenceSourceKind = (typeof ALPHA_EVIDENCE_SOURCE_KINDS)[number];
