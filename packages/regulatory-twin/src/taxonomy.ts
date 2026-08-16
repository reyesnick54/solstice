/**
 * Regulatory Digital Twin vocabularies.
 *
 * This is a simulation / counterfactual layer. It is not a second Kernel,
 * policy engine, or jurisdiction-pack store. Statuses never auto-promote
 * to CONFIRMED_BY_COUNSEL.
 */

export const FACT_SOURCE_KINDS = [
  'CURRENT_PRODUCTION_SIMULATION_FACT',
  'HISTORICAL_FACT',
  'SYNTHETIC_FACT',
  'HYPOTHETICAL_FACT',
  'LEGAL_ASSUMPTION',
] as const;
export type FactSourceKind = (typeof FACT_SOURCE_KINDS)[number];

export const RDT_DECISION_CLASSES = [
  'ALLOW',
  'REQUIRE_MANUAL_REVIEW',
  'DEFER',
  'BLOCK',
  'INSUFFICIENT_FACTS',
] as const;
export type RdtDecisionClass = (typeof RDT_DECISION_CLASSES)[number];

export const DECISION_TRANSITIONS = [
  'ALLOW_TO_ALLOW',
  'ALLOW_TO_REVIEW',
  'ALLOW_TO_DEFER',
  'ALLOW_TO_BLOCK',
  'REVIEW_TO_ALLOW',
  'REVIEW_TO_REVIEW',
  'REVIEW_TO_DEFER',
  'REVIEW_TO_BLOCK',
  'DEFER_TO_ALLOW',
  'DEFER_TO_REVIEW',
  'DEFER_TO_DEFER',
  'DEFER_TO_BLOCK',
  'BLOCK_TO_ALLOW',
  'BLOCK_TO_REVIEW',
  'BLOCK_TO_DEFER',
  'BLOCK_TO_BLOCK',
] as const;
export type DecisionTransition = (typeof DECISION_TRANSITIONS)[number];

export const RESTRICTIVENESS_CHANGES = [
  'UNCHANGED',
  'MATERIALLY_MORE_RESTRICTIVE',
  'MATERIALLY_LESS_RESTRICTIVE',
] as const;
export type RestrictivenessChange = (typeof RESTRICTIVENESS_CHANGES)[number];

export const READINESS_STATES = [
  'SIMULATION_READY',
  'RESEARCH_REQUIRED',
  'COUNSEL_REVIEW_REQUIRED',
  'CONTROL_GAP',
  'TECHNICAL_GAP',
  'NOT_SUPPORTED',
  'DEPENDENCY_NOT_IMPLEMENTED',
] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_DISPOSITIONS = [
  'ACKNOWLEDGED',
  'NEEDS_RESEARCH',
  'NEEDS_COUNSEL',
  'TECHNICAL_CHANGES_REQUIRED',
  'SIMULATION_ACCEPTED',
] as const;
export type ReadinessDisposition = (typeof READINESS_DISPOSITIONS)[number];

export const SCENARIO_CATEGORIES = [
  'US_RETAIL_ACCOUNT',
  'SAUDI_RETAIL_ACCOUNT',
  'US_SA_CROSS_BORDER',
  'CARD_PROGRAM',
  'MERCHANT_ACCEPTANCE',
  'WALLET_PROVISIONING',
  'HIGH_RISK_CUSTOMER',
  'GROWTH_PLAN',
  'INVESTMENT_PLACEHOLDER',
  'INVARIANT_CONTROL',
  'SUNREY_COIN_ISSUANCE',
  'SUNREY_COIN_TRANSFER',
  'SUNREY_COIN_REWARD',
  'SUNREY_COIN_BURN',
  'INFORMATION_MARKET_REQUEST',
  'RESEARCH_PARTICIPATION',
  'COMPUTE_TO_DATA',
  'ATTESTATION_PRODUCT',
  'INFORMATION_COMPENSATION',
] as const;
export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export const GROWTH_IMPACT_STATES = [
  'REMAIN_PERMITTED',
  'REQUIRE_REVIEW',
  'BECOME_BLOCKED',
  'BECOME_UNSUPPORTED',
] as const;
export type GrowthImpactState = (typeof GROWTH_IMPACT_STATES)[number];

export const EVIDENCE_KIND_SIMULATION = 'REGULATORY_TWIN_SIMULATION' as const;

export const FORBIDDEN_READINESS_CLAIMS = [
  'LEGALLY_APPROVED',
  'NETWORK_APPROVED',
  'APPLE_APPROVED',
  'GOOGLE_APPROVED',
  'ACQUIRING_PERMISSION',
  'PCI_CERTIFIED',
] as const;
export type ForbiddenReadinessClaim = (typeof FORBIDDEN_READINESS_CLAIMS)[number];
