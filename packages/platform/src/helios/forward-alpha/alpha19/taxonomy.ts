/**
 * HELIOS FORWARD ALPHA — ALPHA19 outcome maturity and delayed label engine.
 * Simulation / research only — no execution authority.
 */

export const HELIOS_ALPHA19_WORK_PACKAGE = 'ALPHA19' as const;

export const HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA =
  'sunrey.helios.forward-alpha.alpha19.v1' as const;

export const HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED =
  'HELIOS_ALPHA19_OUTCOME_MATURITY_QUALIFIED' as const;

export const HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED =
  'HELIOS_ALPHA19_OUTCOME_MATURITY_BLOCKED' as const;

/** Canonical evaluation horizon identifiers (strategy declares subset before campaign start). */
export const CANONICAL_OUTCOME_HORIZON_IDS = Object.freeze([
  '5m',
  '30m',
  '1h',
  '1d',
  '5d',
  '20d',
  '60d',
] as const);

export type CanonicalOutcomeHorizonId = (typeof CANONICAL_OUTCOME_HORIZON_IDS)[number];

export const OUTCOME_RESOLUTION_STATUSES = Object.freeze([
  'PENDING',
  'MATURED',
  'OUTCOME_DATA_INCOMPLETE',
] as const);

export type OutcomeResolutionStatus = (typeof OUTCOME_RESOLUTION_STATUSES)[number];

export const OUTCOME_REALIZED_LABELS = Object.freeze(['UP', 'DOWN', 'FLAT'] as const);
export type OutcomeRealizedLabel = (typeof OUTCOME_REALIZED_LABELS)[number];
