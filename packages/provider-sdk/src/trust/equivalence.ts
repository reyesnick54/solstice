/**
 * Semantic equivalence, unit compatibility, and time alignment checks.
 */

import type { ExternalObservation } from '../types.ts';
import type { TrustObservationContext } from './types.ts';

export type EquivalenceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'SEMANTIC_MISMATCH' | 'UNIT_MISMATCH' | 'TIME_MISMATCH'; readonly message: string };

export function normalizeSemanticKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

export function checkSemanticEquivalence(
  contexts: readonly TrustObservationContext[],
  requiredSemanticKey: string,
): EquivalenceResult {
  const normalized = normalizeSemanticKey(requiredSemanticKey);
  for (const ctx of contexts) {
    const key = ctx.semanticKey ?? inferSemanticKey(ctx.observation);
    if (normalizeSemanticKey(key) !== normalized) {
      return Object.freeze({
        ok: false,
        code: 'SEMANTIC_MISMATCH',
        message: `Observation ${ctx.observation.observationId} semantic key ${key} does not match ${requiredSemanticKey}`,
      });
    }
  }
  return Object.freeze({ ok: true });
}

export function inferSemanticKey(observation: ExternalObservation<unknown>): string {
  const data = observation.data as Record<string, unknown>;
  const parts = [
    observation.capability,
    observation.source.dataset,
    typeof data.symbol === 'string' ? data.symbol : null,
    typeof data.seriesId === 'string' ? data.seriesId : null,
    typeof data.baseCurrency === 'string' && typeof data.quoteCurrency === 'string'
      ? `${data.baseCurrency}/${data.quoteCurrency}`
      : null,
    typeof data.assetId === 'string' ? data.assetId : null,
    typeof data.chainId === 'string' ? data.chainId : null,
    typeof data.blockHeight === 'number' || typeof data.blockHeight === 'string' ? `height:${data.blockHeight}` : null,
  ].filter(Boolean);
  return parts.join('|') || observation.capability;
}

export function checkUnitCompatibility(
  contexts: readonly TrustObservationContext[],
  requiredUnit: string | null,
): EquivalenceResult {
  if (!requiredUnit) {
    return Object.freeze({ ok: true });
  }
  const normalizedRequired = normalizeUnit(requiredUnit);
  for (const ctx of contexts) {
    const unit = ctx.unit ?? inferUnit(ctx.observation);
    if (!unit) {
      continue;
    }
    if (normalizeUnit(unit) !== normalizedRequired) {
      return Object.freeze({
        ok: false,
        code: 'UNIT_MISMATCH',
        message: `Observation ${ctx.observation.observationId} unit ${unit} incompatible with ${requiredUnit}`,
      });
    }
  }
  return Object.freeze({ ok: true });
}

export function inferUnit(observation: ExternalObservation<unknown>): string | null {
  const data = observation.data as Record<string, unknown>;
  if (typeof data.unit === 'string') return data.unit;
  if (typeof data.currency === 'string') return data.currency;
  return null;
}

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

export function checkTimeAlignment(
  contexts: readonly TrustObservationContext[],
  maxSkewMs: number,
  referenceMs?: number,
): EquivalenceResult {
  const timestamps = contexts.map((ctx) => observationReferenceMs(ctx.observation)).filter((ms): ms is number => ms !== null);
  if (timestamps.length <= 1) {
    return Object.freeze({ ok: true });
  }
  const ref = referenceMs ?? Math.min(...timestamps);
  for (const ctx of contexts) {
    const ms = observationReferenceMs(ctx.observation);
    if (ms === null) {
      continue;
    }
    if (Math.abs(ms - ref) > maxSkewMs) {
      return Object.freeze({
        ok: false,
        code: 'TIME_MISMATCH',
        message: `Observation ${ctx.observation.observationId} time skew ${Math.abs(ms - ref)}ms exceeds ${maxSkewMs}ms`,
      });
    }
  }
  return Object.freeze({ ok: true });
}

export function observationReferenceMs(observation: ExternalObservation<unknown>): number | null {
  const ts =
    observation.time.effectiveAt ??
    observation.time.sourceTimestamp ??
    observation.time.retrievedAt;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : null;
}

export function filterSemanticallyEquivalent(
  contexts: readonly TrustObservationContext[],
  requiredSemanticKey: string,
): { readonly eligible: readonly TrustObservationContext[]; readonly excluded: readonly TrustObservationContext[] } {
  const normalized = normalizeSemanticKey(requiredSemanticKey);
  const eligible: TrustObservationContext[] = [];
  const excluded: TrustObservationContext[] = [];
  for (const ctx of contexts) {
    const key = ctx.semanticKey ?? inferSemanticKey(ctx.observation);
    if (normalizeSemanticKey(key) === normalized) {
      eligible.push(ctx);
    } else {
      excluded.push(ctx);
    }
  }
  return Object.freeze({ eligible: Object.freeze(eligible), excluded: Object.freeze(excluded) });
}
