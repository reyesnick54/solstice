import type { UtcInstant } from '../../../../../domain/src/time.ts';

export function isKnowableAt(knowableAt: UtcInstant, decisionTimeUtc: UtcInstant): boolean {
  const knowMs = Date.parse(knowableAt);
  const decisionMs = Date.parse(decisionTimeUtc);
  return Number.isFinite(knowMs) && Number.isFinite(decisionMs) && knowMs <= decisionMs;
}

export function filterKnowable<T extends { readonly knowableAt: UtcInstant }>(
  rows: readonly T[],
  decisionTimeUtc: UtcInstant,
): readonly T[] {
  return Object.freeze(rows.filter((row) => isKnowableAt(row.knowableAt, decisionTimeUtc)));
}
