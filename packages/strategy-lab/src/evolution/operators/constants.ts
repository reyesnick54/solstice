/**
 * HELIOS EVOL02 — typed genome mutation and crossover (bounded, catalog-validated).
 */

/** Implementation version: bump when operator semantics change (reproducibility). */
export const EVOLUTION_ENGINE_VERSION = 'helios.evolution.operators.v1' as const;

/** Canonical Risk Engine policy catalog ref — must never be structurally mutated. */
export const CANONICAL_RISK_ENGINE_CATALOG_REF = 'risk.max_strategy_contribution_portfolio_var' as const;

export const HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED =
  'HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED' as const;

export const HELIOS_EVOL02_GENOME_OPERATORS_BLOCKED = 'HELIOS_EVOL02_GENOME_OPERATORS_BLOCKED' as const;
