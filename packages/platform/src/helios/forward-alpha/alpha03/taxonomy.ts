/**
 * HELIOS FORWARD ALPHA — ALPHA03 prequential real-time evaluation engine.
 * Research / simulation only — no execution authority.
 */

export const HELIOS_FORWARD_ALPHA_PROGRAM = 'HELIOS_FORWARD_ALPHA' as const;
export const HELIOS_ALPHA03_WORK_PACKAGE = 'ALPHA03' as const;

export const HELIOS_ALPHA03_PREQUENTIAL_SCHEMA = 'sunrey.helios.forward-alpha.alpha03.v1' as const;

export const HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED =
  'HELIOS_ALPHA03_PREQUENTIAL_ENGINE_QUALIFIED' as const;
export const HELIOS_ALPHA03_PREQUENTIAL_ENGINE_BLOCKED =
  'HELIOS_ALPHA03_PREQUENTIAL_ENGINE_BLOCKED' as const;

/** Chronological MD15 live-shadow observations — may contribute to forward-alpha evidence. */
export const MD15_LIVE_SHADOW_CHRONOLOGICAL = 'MD15_LIVE_SHADOW_CHRONOLOGICAL' as const;
/** Fixture / synthetic forward harness — does not create real forward-alpha evidence. */
export const SIMULATION_FORWARD_HARNESS = 'SIMULATION_FORWARD_HARNESS' as const;

export type PrequentialDataSourceKind =
  | typeof MD15_LIVE_SHADOW_CHRONOLOGICAL
  | typeof SIMULATION_FORWARD_HARNESS;

export const PREQUENTIAL_LOOP_PHASES = Object.freeze([
  'PREDICT',
  'SEAL',
  'WAIT',
  'OBSERVE',
  'SCORE',
  'OPTIONAL_PREDECLARED_UPDATE',
] as const);

export type PrequentialLoopPhase = (typeof PREQUENTIAL_LOOP_PHASES)[number];

export const PREQUENTIAL_PREDICTED_LABELS = Object.freeze(['UP', 'DOWN', 'FLAT'] as const);
export type PrequentialPredictedLabel = (typeof PREQUENTIAL_PREDICTED_LABELS)[number];

export const DEFAULT_OUTCOME_HORIZON_MS = 3_600_000 as const;
