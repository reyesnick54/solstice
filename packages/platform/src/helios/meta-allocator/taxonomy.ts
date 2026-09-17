/**
 * HELIOS H20 Meta Allocator taxonomies.
 * Recommends bounded allocation decisions only. Does not move money or issue Execution Authority.
 */

import {
  WORK_ORDER_DISPOSITIONS,
  type WorkOrderDisposition,
} from '../../work-order/taxonomy.ts';

export { WORK_ORDER_DISPOSITIONS, type WorkOrderDisposition };

export const META_ALLOCATOR_DECISIONS = WORK_ORDER_DISPOSITIONS;
export type MetaAllocatorDecision = WorkOrderDisposition;

export const RESEARCH_SPEND_DECISIONS = [
  'DO_NOT_RESEARCH',
  'RESEARCH_MINIMAL',
  'RESEARCH_STANDARD',
  'RESEARCH_DEEPER',
  'WAIT_FOR_DATA',
] as const;
export type ResearchSpendDecision = (typeof RESEARCH_SPEND_DECISIONS)[number];

export const CAPITAL_RECOMMENDATION_DECISIONS = [
  'PROPOSE',
  'WAIT',
  'ABANDON',
  'NO_ACTION',
] as const;
export type CapitalRecommendationDecision = (typeof CAPITAL_RECOMMENDATION_DECISIONS)[number];

export const CONFIDENCE_STATES = ['CALIBRATED', 'LOW_CONFIDENCE', 'UNKNOWN'] as const;
export type ConfidenceState = (typeof CONFIDENCE_STATES)[number];

export const EVIDENCE_QUALITY_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'] as const;
export type EvidenceQualityLevel = (typeof EVIDENCE_QUALITY_LEVELS)[number];

export const STRATEGY_QUALIFICATION_STATES = [
  'QUALIFIED',
  'UNQUALIFIED',
  'NEEDS_VALIDATION',
  'REJECTED',
] as const;
export type StrategyQualificationState = (typeof STRATEGY_QUALIFICATION_STATES)[number];

export const LIQUIDITY_STATES = ['ADEQUATE', 'THIN', 'INSUFFICIENT', 'UNKNOWN'] as const;
export type LiquidityState = (typeof LIQUIDITY_STATES)[number];

export const COST_ATTRIBUTION_CLASSES = [
  'RESEARCH_COST',
  'TRADING_COST',
  'CAPITAL_ALLOCATED',
  'RESULTING_PNL',
] as const;
export type CostAttributionClass = (typeof COST_ATTRIBUTION_CLASSES)[number];

export const RESEARCH_REUSE_RIGHTS = ['PUBLIC', 'LICENSED', 'CUSTOMER_PRIVATE', 'UNAVAILABLE'] as const;
export type ResearchReuseRights = (typeof RESEARCH_REUSE_RIGHTS)[number];

export const META_ALLOCATOR_POLICY_VERSION = 'HELIOS_META_ALLOCATOR_POLICY_V1' as const;

export const META_ALLOCATOR_REASON_CODES = [
  'BUDGET_LOW',
  'BUDGET_EXHAUSTED',
  'HIGH_INFORMATION_VALUE',
  'LOW_INFORMATION_VALUE',
  'INSUFFICIENT_EVIDENCE',
  'STRATEGY_UNQUALIFIED',
  'ACCOUNT_TOO_SMALL',
  'COSTS_CONSUME_EDGE',
  'INSUFFICIENT_LIQUIDITY',
  'CONCENTRATION_LIMIT',
  'CAPITAL_ALREADY_CLAIMED',
  'COMPETING_CANDIDATE_PRIORITY',
  'NO_QUALIFYING_CANDIDATES',
  'UNKNOWN_CONFIDENCE',
  'LOW_CONFIDENCE',
  'WAIT_FOR_DATA',
  'RESEARCH_TOO_EXPENSIVE',
  'STRONG_EVIDENCE',
  'FEASIBLE_DEPLOYMENT',
  'INFEASIBLE_DEPLOYMENT',
  'PUBLIC_RESEARCH_REUSED',
  'HOLD_CASH',
] as const;
export type MetaAllocatorReasonCode = (typeof META_ALLOCATOR_REASON_CODES)[number];
