/**
 * Deterministic numeric consensus strategies.
 */

import type { AuthorityClass } from '../types.ts';
import { authorityRank } from './policies.ts';
import { median } from './outliers.ts';
import type { SelectionMethod, TrustObservationContext } from './types.ts';
import { computeObservationWeight } from './factors.ts';

export type NumericConsensusInput = {
  readonly contexts: readonly TrustObservationContext[];
  readonly method: SelectionMethod;
  readonly authorityPrecedence: readonly AuthorityClass[];
};

export type NumericConsensusResult = {
  readonly value: number | null;
  readonly selectedObservationIds: readonly string[];
  readonly supportingObservationIds: readonly string[];
  readonly method: SelectionMethod;
};

export function numericConsensus(input: NumericConsensusInput): NumericConsensusResult {
  const withValues = input.contexts.filter(
    (c) => c.numericValue !== undefined && c.numericValue !== null && Number.isFinite(c.numericValue),
  );
  if (withValues.length === 0) {
    return Object.freeze({
      value: null,
      selectedObservationIds: Object.freeze([]),
      supportingObservationIds: Object.freeze([]),
      method: 'NO_SELECTION',
    });
  }

  switch (input.method) {
    case 'AUTHORITY_PRECEDENCE':
    case 'SINGLE_AUTHORITATIVE_SOURCE':
      return authorityPrecedenceConsensus(withValues, input.authorityPrecedence);
    case 'WEIGHTED_MEDIAN':
      return weightedMedianConsensus(withValues, input.authorityPrecedence);
    case 'MEDIAN':
      return simpleMedianConsensus(withValues);
    case 'TRIMMED_MEAN':
      return trimmedMeanConsensus(withValues);
    default:
      return simpleMedianConsensus(withValues);
  }
}

function authorityPrecedenceConsensus(
  contexts: readonly TrustObservationContext[],
  precedence: readonly AuthorityClass[],
): NumericConsensusResult {
  const sorted = [...contexts].sort(
    (a, b) =>
      authorityRank(a.observation.authority.authorityClass, precedence) -
      authorityRank(b.observation.authority.authorityClass, precedence),
  );
  const best = sorted[0]!;
  const sameAuthority = sorted.filter(
    (c) => c.observation.authority.authorityClass === best.observation.authority.authorityClass,
  );
  if (sameAuthority.length > 1) {
    const medResult = simpleMedianConsensus(sameAuthority);
    return Object.freeze({
      value: medResult.value,
      selectedObservationIds: medResult.selectedObservationIds,
      supportingObservationIds: Object.freeze(sameAuthority.map((c) => c.observation.observationId)),
      method: 'AUTHORITY_PRECEDENCE',
    });
  }
  return Object.freeze({
    value: best.numericValue!,
    selectedObservationIds: Object.freeze([best.observation.observationId]),
    supportingObservationIds: Object.freeze([best.observation.observationId]),
    method: 'AUTHORITY_PRECEDENCE',
  });
}

function weightedMedianConsensus(
  contexts: readonly TrustObservationContext[],
  precedence: readonly AuthorityClass[],
): NumericConsensusResult {
  const weighted = contexts.map((c) => ({
    observationId: c.observation.observationId,
    value: c.numericValue!,
    weight: computeObservationWeight(c, precedence),
  }));
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight <= 0) {
    return simpleMedianConsensus(contexts);
  }
  const sorted = [...weighted].sort((a, b) => a.value - b.value);
  let cumulative = 0;
  let selectedId = sorted[0]!.observationId;
  let selectedValue = sorted[0]!.value;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= totalWeight / 2) {
      selectedId = entry.observationId;
      selectedValue = entry.value;
      break;
    }
  }
  const supporting = weighted
    .filter((w) => Math.abs(w.value - selectedValue) / Math.max(Math.abs(selectedValue), 1e-9) < 0.01)
    .map((w) => w.observationId);
  return Object.freeze({
    value: selectedValue,
    selectedObservationIds: Object.freeze([selectedId]),
    supportingObservationIds: Object.freeze(supporting),
    method: 'WEIGHTED_MEDIAN',
  });
}

function simpleMedianConsensus(contexts: readonly TrustObservationContext[]): NumericConsensusResult {
  const values = contexts.map((c) => c.numericValue!);
  const med = median(values);
  if (med === null) {
    return Object.freeze({
      value: null,
      selectedObservationIds: Object.freeze([]),
      supportingObservationIds: Object.freeze([]),
      method: 'MEDIAN',
    });
  }
  const closest = contexts.reduce((best, c) => {
    const dist = Math.abs(c.numericValue! - med);
    const bestDist = Math.abs(best.numericValue! - med);
    return dist < bestDist ? c : best;
  });
  const supporting = contexts
    .filter((c) => Math.abs(c.numericValue! - med) / Math.max(Math.abs(med), 1e-9) < 0.01)
    .map((c) => c.observation.observationId);
  return Object.freeze({
    value: med,
    selectedObservationIds: Object.freeze([closest.observation.observationId]),
    supportingObservationIds: Object.freeze(supporting),
    method: 'MEDIAN',
  });
}

function trimmedMeanConsensus(contexts: readonly TrustObservationContext[]): NumericConsensusResult {
  const sorted = [...contexts].sort((a, b) => a.numericValue! - b.numericValue!);
  const trim = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trim, sorted.length - trim || sorted.length);
  const slice = trimmed.length > 0 ? trimmed : sorted;
  const mean = slice.reduce((sum, c) => sum + c.numericValue!, 0) / slice.length;
  const closest = slice.reduce((best, c) => {
    const dist = Math.abs(c.numericValue! - mean);
    const bestDist = Math.abs(best.numericValue! - mean);
    return dist < bestDist ? c : best;
  });
  return Object.freeze({
    value: Math.round(mean * 1_000_000) / 1_000_000,
    selectedObservationIds: Object.freeze([closest.observation.observationId]),
    supportingObservationIds: Object.freeze(slice.map((c) => c.observation.observationId)),
    method: 'TRIMMED_MEAN',
  });
}
