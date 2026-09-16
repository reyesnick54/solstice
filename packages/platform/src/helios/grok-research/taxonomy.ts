/**
 * H11 — Bounded Grok research taxonomies.
 * Public research only. Does not grant Execution Authority.
 */

export const GROK_RESEARCH_SCHEMA_VERSION = 'sunrey.helios.grok-research.v1' as const;

export const ASSERTION_KINDS = [
  'FACT',
  'INFERENCE',
  'HYPOTHESIS',
  'UNKNOWN',
  'CONTRADICTED',
] as const;
export type AssertionKind = (typeof ASSERTION_KINDS)[number];

export const RESEARCH_RECOMMENDATION_CLASSES = [
  'INVESTIGATE',
  'PROPOSE_CANDIDATE',
  'WAIT',
  'ABANDON',
  'NO_ACTION',
] as const;
export type ResearchRecommendationClass = (typeof RESEARCH_RECOMMENDATION_CLASSES)[number];

export const RESEARCH_COMPLETION_STATUSES = [
  'COMPLETED',
  'PARTIAL_DEGRADED',
  'BUDGET_EXHAUSTED',
  'LIMIT_REACHED',
  'CANCELLED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'PRIVATE_CONTEXT_REJECTED',
  'FAILED',
] as const;
export type ResearchCompletionStatus = (typeof RESEARCH_COMPLETION_STATUSES)[number];

export const RESEARCH_PRIVACY_CLASSES = [
  'PUBLIC',
  'CUSTOMER_PRIVATE',
  'RESTRICTED',
] as const;
export type ResearchPrivacyClass = (typeof RESEARCH_PRIVACY_CLASSES)[number];

export const RESEARCH_TOOL_CATEGORIES = [
  'MARKET_OBSERVATION',
  'ECONOMIC_DATA_SEARCH',
  'DOCUMENT_SEARCH',
  'FILING_LOOKUP',
  'ECONOMIC_CALENDAR',
  'INSTRUMENT_METADATA',
  'QUANT_ANALYTICS',
  'RESEARCH_CORPUS',
  'EXTERNAL_DATA_TRUST',
] as const;
export type ResearchToolCategory = (typeof RESEARCH_TOOL_CATEGORIES)[number];

export const TOOL_AUTHORIZATION_OUTCOMES = [
  'ALLOWED',
  'DENIED_NOT_REGISTERED',
  'DENIED_NOT_PERMITTED',
  'DENIED_PRIVACY',
  'DENIED_BUDGET',
  'DENIED_INVALID_INPUT',
  'DENIED_MUTATION_FORBIDDEN',
] as const;
export type ToolAuthorizationOutcome = (typeof TOOL_AUTHORIZATION_OUTCOMES)[number];

export const HELIOS_H11_GROK_RESEARCH = 'HELIOS_H11_GROK_RESEARCH' as const;
