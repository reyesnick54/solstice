/**
 * HELIOS EVOL14 — Strategy Genome self-evolution qualification markers (simulation-only).
 */

export const HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED =
  'HELIOS_STRATEGY_SELF_EVOLUTION_V1_QUALIFIED' as const;

export const HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED =
  'HELIOS_STRATEGY_SELF_EVOLUTION_V1_BLOCKED' as const;

/** EVOL01–EVOL13 capability identifiers (documentation and matrix alignment). */
export const EVOL_CAPABILITY_IDS = [
  'EVOL01',
  'EVOL02',
  'EVOL03',
  'EVOL04',
  'EVOL05',
  'EVOL06',
  'EVOL07',
  'EVOL08',
  'EVOL09',
  'EVOL10',
  'EVOL11',
  'EVOL12',
  'EVOL13',
] as const;

export type EvolCapabilityId = (typeof EVOL_CAPABILITY_IDS)[number];
