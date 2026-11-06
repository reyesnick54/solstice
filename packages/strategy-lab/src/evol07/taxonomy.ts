/**
 * HELIOS EVOL07 — novelty search and strategy diversity engine (taxonomy).
 */

export const HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION = 'evol07.behavior.v1' as const;

export const HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION = 'evol07.semantic.v1' as const;

export const HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION = 'evol07.nn.v1' as const;

/** Marker asserted when engineering qualification checks pass (CI / harness). */
export const HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED = 'HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED' as const;

export const HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED = 'HELIOS_EVOL07_NOVELTY_ENGINE_BLOCKED' as const;

/** Default neutral diagnostic dataset id for behavioral fingerprints (fixture / catalog). */
export const HELIOS_EVOL07_NEUTRAL_DIAGNOSTIC_DATASET_ID = 'helios.evol07.neutral_diagnostic.v1' as const;
