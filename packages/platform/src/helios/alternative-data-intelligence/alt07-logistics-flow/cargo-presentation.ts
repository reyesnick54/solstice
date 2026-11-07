/**
 * Cargo evidence presentation policy — inferred cargo must not read as observed.
 */

import type { CargoAttribution } from './types.ts';
import { CARGO_EVIDENCE_CLASSES, type CargoEvidenceClass } from './taxonomy.ts';

const PRESENTATION_BY_CLASS: Readonly<Record<CargoEvidenceClass, string>> = Object.freeze({
  OBSERVED_CARGO: 'observed cargo',
  DECLARED_CARGO: 'declared cargo',
  INFERRED_CARGO: 'inferred cargo (model-based)',
  UNKNOWN: 'cargo unknown',
});

export function cargoPresentationLabel(evidenceClass: CargoEvidenceClass): string {
  return PRESENTATION_BY_CLASS[evidenceClass];
}

export function buildCargoAttribution(input: {
  readonly evidenceClass: CargoEvidenceClass;
  readonly commodityCode: string | null;
  readonly sourceObservationIds: readonly string[];
}): CargoAttribution {
  const presentationLabel = cargoPresentationLabel(input.evidenceClass);
  return Object.freeze({
    evidenceClass: input.evidenceClass,
    commodityCode: input.commodityCode,
    presentationLabel,
    sourceObservationIds: Object.freeze([...input.sourceObservationIds]),
  });
}

/** Returns false when presentation text falsely implies direct observation. */
export function cargoPresentationPolicySatisfied(cargo: CargoAttribution): boolean {
  const label = cargo.presentationLabel.toLowerCase();
  if (cargo.evidenceClass === 'INFERRED_CARGO') {
    if (label.includes('observed') && !label.includes('inferred')) {
      return false;
    }
    return label.includes('inferred');
  }
  if (cargo.evidenceClass === 'OBSERVED_CARGO') {
    return label.includes('observed');
  }
  if (cargo.evidenceClass === 'DECLARED_CARGO') {
    return label.includes('declared');
  }
  return true;
}

export function assertCargoEvidenceClass(value: string): CargoEvidenceClass {
  if ((CARGO_EVIDENCE_CLASSES as readonly string[]).includes(value)) {
    return value as CargoEvidenceClass;
  }
  return 'UNKNOWN';
}
