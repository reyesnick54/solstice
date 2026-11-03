import type { UtcInstant } from '../../../../../domain/src/time.ts';

export function isEffectiveAt(
  effectiveFrom: UtcInstant,
  effectiveTo: UtcInstant | null,
  asOf: UtcInstant,
): boolean {
  const asOfMs = Date.parse(asOf);
  const fromMs = Date.parse(effectiveFrom);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(fromMs) || asOfMs < fromMs) {
    return false;
  }
  if (effectiveTo === null) {
    return true;
  }
  const toMs = Date.parse(effectiveTo);
  return Number.isFinite(toMs) && asOfMs < toMs;
}

export function isKnowableAt(knowableAt: UtcInstant, cutoff: UtcInstant): boolean {
  const knowableMs = Date.parse(knowableAt);
  const cutoffMs = Date.parse(cutoff);
  return Number.isFinite(knowableMs) && Number.isFinite(cutoffMs) && knowableMs <= cutoffMs;
}

export function mappingActive(
  row: {
    readonly effectiveFrom: UtcInstant;
    readonly effectiveTo: UtcInstant | null;
    readonly knowableAt: UtcInstant;
  },
  asOf: UtcInstant,
  knowableAtCutoff: UtcInstant,
): boolean {
  return isEffectiveAt(row.effectiveFrom, row.effectiveTo, asOf) && isKnowableAt(row.knowableAt, knowableAtCutoff);
}
