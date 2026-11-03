/**
 * HELIOS Native OSS Assimilation NATIVE14 — unified cross-market intelligence.
 * Research and opportunity discovery only; never execution authority.
 */

export const HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_SCHEMA =
  'sunrey.helios.native-assimilation.native14-cross-market.v1' as const;

export const HELIOS_NATIVE14_CROSS_MARKET_INTELLIGENCE_AUTHORITY =
  'packages/platform/src/helios/native-assimilation/native14-cross-market-intelligence' as const;

export const HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED =
  'HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_QUALIFIED' as const;

export const HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED =
  'HELIOS_NATIVE_CROSS_MARKET_INTELLIGENCE_BLOCKED' as const;

/** Domains that may feed the unified cross-market graph (simulation fixtures only). */
export const CROSS_MARKET_SIGNAL_DOMAINS = Object.freeze([
  'EQUITIES',
  'ETF',
  'INDICES',
  'CRYPTO',
  'COMMODITIES',
  'FX',
  'FUTURES',
  'MACRO',
  'FUNDAMENTALS',
  'PREDICTION_MARKET',
  'NEWS',
  'SENTIMENT',
  'AGENT_RESEARCH',
] as const);

export type CrossMarketSignalDomain = (typeof CROSS_MARKET_SIGNAL_DOMAINS)[number];

export const CROSS_MARKET_GRAPH_NODE_KINDS = Object.freeze([
  'INSTRUMENT',
  'MACRO_METRIC',
  'PREDICTION_OUTCOME',
  'SENTIMENT_INDEX',
  'RESEARCH_ARTIFACT',
] as const);

export type CrossMarketGraphNodeKind = (typeof CROSS_MARKET_GRAPH_NODE_KINDS)[number];

export const CROSS_MARKET_GRAPH_EDGE_KINDS = Object.freeze([
  'CO_MOVEMENT',
  'IMPLIED_PROBABILITY_LINK',
  'FUNDING_LINK',
  'VENUE_ARBITRAGE',
  'MACRO_TRANSMISSION',
  'SENTIMENT_ALIGNMENT',
  'AGENT_CORROBORATION',
] as const);

export type CrossMarketGraphEdgeKind = (typeof CROSS_MARKET_GRAPH_EDGE_KINDS)[number];

export const CROSS_MARKET_RESEARCH_TRIGGER_KINDS = Object.freeze([
  'MACRO_RESEARCH',
  'CRYPTO_RESEARCH',
] as const);

export type CrossMarketResearchTriggerKind = (typeof CROSS_MARKET_RESEARCH_TRIGGER_KINDS)[number];

export const DISLOCATION_SEVERITY_BANDS = Object.freeze(['LOW', 'ELEVATED', 'SEVERE'] as const);
export type DislocationSeverityBand = (typeof DISLOCATION_SEVERITY_BANDS)[number];

/** Minimum aligned domains before a research trigger fires (correlation alone is insufficient). */
export const MIN_DOMAINS_FOR_RESEARCH_TRIGGER = 3 as const;
