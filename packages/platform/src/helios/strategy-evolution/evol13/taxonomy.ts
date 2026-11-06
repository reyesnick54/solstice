/**
 * HELIOS EVOL13 — Meta-evolution and operator credit assignment (research compute only).
 * Tracks research-process metrics; does not score raw backtest Sharpe or move customer capital.
 */

export const HELIOS_EVOL13_STRATEGY_EVOLUTION_SCHEMA = 'sunrey.helios.strategy_evolution.evol13.v1' as const;

export const RESEARCH_STRATEGY_NICHES = [
  'MOMENTUM',
  'VALUATION',
  'NEUTRAL',
  'CROSS_SECTIONAL',
  'MACRO',
] as const;
export type ResearchStrategyNiche = (typeof RESEARCH_STRATEGY_NICHES)[number];

/** Evolutionary / search operators whose productivity is measured (examples from spec). */
export const STRATEGY_EVOLUTION_OPERATORS = [
  'PARAMETER_MUTATION',
  'FEATURE_SUBSTITUTION',
  'SUBGRAPH_MUTATION',
  'CROSSOVER',
  'CMA_ES',
  'LLM_PROPOSAL',
  'RANDOM_EXPLORATION',
] as const;
export type StrategyEvolutionOperatorId = (typeof STRATEGY_EVOLUTION_OPERATORS)[number];

export const EVOL13_ALLOCATION_POLICIES = ['THOMPSON', 'UCB'] as const;
export type Evol13AllocationPolicyKind = (typeof EVOL13_ALLOCATION_POLICIES)[number];

export const HELIOS_EVOL13_META_EVOLUTION_QUALIFIED = 'HELIOS_EVOL13_META_EVOLUTION_QUALIFIED' as const;
export const HELIOS_EVOL13_META_EVOLUTION_BLOCKED = 'HELIOS_EVOL13_META_EVOLUTION_BLOCKED' as const;
