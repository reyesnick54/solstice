/**
 * HELIOS Market Data MD08 — derivatives market-state intelligence.
 */

export const HELIOS_MD08_DERIVATIVES_SCHEMA = 'sunrey.helios.market-data.md08-derivatives.v1' as const;
export const HELIOS_MD08_DERIVATIVES_AUTHORITY = 'REFERENCE_ONLY' as const;

export const HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED = 'HELIOS_MD08_DERIVATIVES_DATA_QUALIFIED' as const;
export const HELIOS_MD08_DERIVATIVES_DATA_BLOCKED = 'HELIOS_MD08_DERIVATIVES_DATA_BLOCKED' as const;

/** Whether a field came from the exchange feed or from an internal model. */
export const MD08_PROVENANCE_KINDS = ['OBSERVED', 'DERIVED'] as const;
export type Md08ProvenanceKind = (typeof MD08_PROVENANCE_KINDS)[number];

export const MD08_OPTION_RIGHTS = ['CALL', 'PUT'] as const;
export type Md08OptionRight = (typeof MD08_OPTION_RIGHTS)[number];

export const MD08_EXERCISE_STYLES = ['AMERICAN', 'EUROPEAN'] as const;
export type Md08ExerciseStyle = (typeof MD08_EXERCISE_STYLES)[number];

export const MD08_TERM_STRUCTURE_SHAPES = ['CONTANGO', 'BACKWARDATION', 'FLAT', 'UNKNOWN'] as const;
export type Md08TermStructureShape = (typeof MD08_TERM_STRUCTURE_SHAPES)[number];

export const MD08_DERIVED_IV_LABEL =
  'MODEL_DERIVED_NOT_EXCHANGE_OBSERVED' as const;

export const MD08_PRICE_MINOR_SCALE = 10_000n;
