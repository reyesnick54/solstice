/**
 * HELIOS Multi-Asset M14 — macro and event intelligence taxonomy.
 *
 * Research and opportunity discovery only. Does not grant Execution Authority.
 */

export const HELIOS_MACRO_EVENT_INTELLIGENCE_SCHEMA = 'sunrey.helios.macro-event-intelligence.v1' as const;
export const HELIOS_MACRO_EVENT_INTELLIGENCE_AUTHORITY = 'REFERENCE_ONLY' as const;

export const MACRO_EVENT_TYPES = [
  'scheduled_event',
  'observed_release',
  'policy_announcement',
  'market_disruption',
  'supply_demand_event',
  'corporate_event',
  'geopolitical_market_event',
  'unknown_unclassified',
] as const;
export type MacroEventType = (typeof MACRO_EVENT_TYPES)[number];

export const MACRO_EVENT_DOMAINS = [
  'central_bank_decision',
  'interest_rate',
  'inflation_release',
  'employment_release',
  'gdp_economic_data',
  'treasury_rate_event',
  'crude_inventory',
  'opec_event',
  'commodity_supply_event',
  'scheduled_earnings',
  'market_structure_event',
  'geopolitical_market_event',
] as const;
export type MacroEventDomain = (typeof MACRO_EVENT_DOMAINS)[number];

export const KNOWLEDGE_LAYERS = [
  'source_fact',
  'structured_observation',
  'model_inference',
  'agent_hypothesis',
] as const;
export type KnowledgeLayer = (typeof KNOWLEDGE_LAYERS)[number];

export const IMPACT_DIRECTION_HYPOTHESES = [
  'BULLISH',
  'BEARISH',
  'NEUTRAL',
  'MIXED',
  'UNKNOWN',
] as const;
export type ImpactDirectionHypothesis = (typeof IMPACT_DIRECTION_HYPOTHESES)[number];

export const EVENT_IMPACT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type EventImpactSeverity = (typeof EVENT_IMPACT_SEVERITIES)[number];

export const EVENT_RELEVANCE_STATES = ['UPCOMING', 'ACTIVE', 'EXPIRED', 'UNKNOWN'] as const;
export type EventRelevanceState = (typeof EVENT_RELEVANCE_STATES)[number];

export const MACRO_EVENT_MODEL_ROUTES = [
  'DETERMINISTIC',
  'GROK_PUBLIC_RESEARCH',
  'S3M_PRIVATE_CONTEXT',
] as const;
export type MacroEventModelRoute = (typeof MACRO_EVENT_MODEL_ROUTES)[number];

export const HELIOS_MULTI_ASSET_M14 = 'HELIOS_MULTI_ASSET_M14' as const;
