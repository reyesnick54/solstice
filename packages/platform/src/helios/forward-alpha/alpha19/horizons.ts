import type { CanonicalOutcomeHorizonId } from './taxonomy.ts';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export const CANONICAL_OUTCOME_HORIZON_MS: Readonly<Record<CanonicalOutcomeHorizonId, number>> =
  Object.freeze({
    '5m': 5 * MS_PER_MINUTE,
    '30m': 30 * MS_PER_MINUTE,
    '1h': MS_PER_HOUR,
    '1d': MS_PER_DAY,
    '5d': 5 * MS_PER_DAY,
    '20d': 20 * MS_PER_DAY,
    '60d': 60 * MS_PER_DAY,
  });

export function horizonMsForId(horizonId: CanonicalOutcomeHorizonId): number {
  return CANONICAL_OUTCOME_HORIZON_MS[horizonId];
}

export function assertKnownHorizonId(
  horizonId: string,
): { readonly ok: true; readonly id: CanonicalOutcomeHorizonId } | { readonly ok: false } {
  if (Object.prototype.hasOwnProperty.call(CANONICAL_OUTCOME_HORIZON_MS, horizonId)) {
    return Object.freeze({ ok: true, id: horizonId as CanonicalOutcomeHorizonId });
  }
  return Object.freeze({ ok: false });
}
