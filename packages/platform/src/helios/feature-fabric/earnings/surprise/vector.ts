/**
 * EarningsSurpriseVector — composite without a universal scalar score.
 */

import { HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA } from './taxonomy.ts';
import type { EarningsSurpriseTensor, EarningsSurpriseVector, EarningsSurpriseVectorSlot } from './types.ts';

export function buildEarningsSurpriseVector(input: {
  readonly vectorId: string;
  readonly tensor: EarningsSurpriseTensor;
}): EarningsSurpriseVector {
  const orderedSlots: EarningsSurpriseVectorSlot[] = input.tensor.cells
    .filter((cell) => cell.calculable)
    .map((decomposition) =>
      Object.freeze({
        cellKey: decomposition.key,
        decomposition,
      }),
    );

  return Object.freeze({
    schema: HELIOS_EARN03_SURPRISE_TENSOR_SCHEMA,
    vectorId: input.vectorId,
    tensorRef: input.tensor.expectationSnapshot.snapshotId,
    evaluationTimeUtc: input.tensor.evaluationTimeUtc,
    orderedSlots: Object.freeze(orderedSlots),
    grantsExecutionAuthority: false as const,
  });
}

/** Explicitly rejects blending expectation sources into one scalar. */
export function assertNoMixedSourceScalar(
  weights: Readonly<Record<string, number>>,
  cells: EarningsSurpriseVector['orderedSlots'],
): { readonly ok: true } | { readonly ok: false; readonly code: 'SOURCE_MIXING_REJECTED'; readonly message: string } {
  const sources = new Set(cells.map((slot) => slot.cellKey.expectationSource));
  if (sources.size <= 1) {
    return { ok: true };
  }
  const activeSources = new Set<string>();
  for (const [key, weight] of Object.entries(weights)) {
    if (weight === 0) continue;
    const slot = cells.find((row) => vectorSlotId(row) === key);
    if (slot) activeSources.add(slot.cellKey.expectationSource);
  }
  if (activeSources.size > 1) {
    return {
      ok: false,
      code: 'SOURCE_MIXING_REJECTED',
      message: 'weights span multiple expectation sources',
    };
  }
  return { ok: true };
}

export function vectorSlotId(slot: EarningsSurpriseVectorSlot): string {
  const seg = slot.cellKey.segmentId ?? 'consolidated';
  return `${slot.cellKey.dimension}|${seg}|${slot.cellKey.method}|${slot.cellKey.expectationSource}`;
}
