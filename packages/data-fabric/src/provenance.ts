/**
 * Provenance is a type-level brand. A synthetic record and a real record
 * cannot be assigned to each other. This phase stores SYNTHETIC only.
 * There is no constructor that produces a REAL record.
 */

export const PROVENANCE = {
  SYNTHETIC: 'SYNTHETIC',
  REAL: 'REAL',
} as const;

export type Provenance = (typeof PROVENANCE)[keyof typeof PROVENANCE];

declare const syntheticBrand: unique symbol;
declare const realBrand: unique symbol;

export type SyntheticBrand = { readonly [syntheticBrand]: 'SYNTHETIC' };
export type RealBrand = { readonly [realBrand]: 'REAL' };

export type SyntheticLabel = {
  readonly provenance: 'SYNTHETIC';
  readonly syntheticLabel: 'SYNTHETIC_FABRICATED_RECORD';
} & SyntheticBrand;

export type RealLabel = {
  readonly provenance: 'REAL';
} & RealBrand;

export function asSyntheticLabel(): SyntheticLabel {
  return Object.freeze({
    provenance: 'SYNTHETIC',
    syntheticLabel: 'SYNTHETIC_FABRICATED_RECORD',
  }) as SyntheticLabel;
}

/**
 * Real personal records are not constructible in this phase.
 * LIVE_DATA_MARKET_ENABLED stays false; no real health or personal data
 * may enter the system.
 */
export function rejectRealProvenance(provenance: unknown): never {
  throw new Error(
    `REAL provenance is refused: this phase accepts SYNTHETIC records only (got ${String(provenance)})`,
  );
}

export function assertSyntheticProvenance(
  value: { readonly provenance: string },
): asserts value is { readonly provenance: 'SYNTHETIC' } {
  if (value.provenance !== 'SYNTHETIC') {
    rejectRealProvenance(value.provenance);
  }
}
