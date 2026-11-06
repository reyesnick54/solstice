/**
 * HELIOS CF08 — counterfactual learning: market response and execution twin fidelity.
 * Distinguishes observed market paths from simulated paths had an order been submitted.
 */

export const HELIOS_CF08_MARKET_RESPONSE_TWIN = 'HELIOS_CF08_MARKET_RESPONSE_TWIN' as const;

/** Qualification marker when CF08 engineering gates pass (research / simulation only). */
export const HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED = 'HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED' as const;
export const HELIOS_CF08_MARKET_RESPONSE_TWIN_BLOCKED = 'HELIOS_CF08_MARKET_RESPONSE_TWIN_BLOCKED' as const;

/** Default deterministic responsive model identifier (baseline; not factual). */
export const HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID =
  'helios.cf08.responsive-market.deterministic-baseline-v1' as const;

export const COUNTERFACTUAL_SIMULATION_FIDELITY_LEVELS = [
  'LEVEL_1_PASSIVE_REPLAY',
  'LEVEL_2_EXECUTION_TWIN',
  'LEVEL_3_RESPONSIVE_MARKET_MODEL',
] as const;

export type CounterfactualSimulationFidelityLevel = (typeof COUNTERFACTUAL_SIMULATION_FIDELITY_LEVELS)[number];

/** Research-only: how a responsive model was produced (deterministic baseline vs future adapters). */
export const RESPONSIVE_MARKET_MODEL_KINDS = [
  'DETERMINISTIC_BASELINE',
  'GENERATIVE_LOB_ADAPTER',
  'DIFFUSION_LOB_ADAPTER',
  'AGENT_BASED_SIMULATION_ADAPTER',
] as const;

export type ResponsiveMarketModelKind = (typeof RESPONSIVE_MARKET_MODEL_KINDS)[number];
