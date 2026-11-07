/**
 * ALT02 — entity resolution and observation hygiene.
 */

export type EntityResolutionGuardResult = {
  readonly featureBlocked: boolean;
  readonly reason: string;
};

export function applyEntityResolutionGuard(input: {
  readonly requestedEntityId: string;
  readonly resolvedEntityId: string;
  readonly confidence: number;
}): EntityResolutionGuardResult {
  const mismatch = input.requestedEntityId !== input.resolvedEntityId;
  const lowConfidence = input.confidence < 0.85;
  const featureBlocked = mismatch || lowConfidence;
  let reason = 'entity resolution acceptable';
  if (mismatch && lowConfidence) {
    reason = `entity mismatch (${input.resolvedEntityId} vs ${input.requestedEntityId}) with low confidence`;
  } else if (mismatch) {
    reason = `wrong company mapping blocks feature (${input.resolvedEntityId} vs ${input.requestedEntityId})`;
  } else if (lowConfidence) {
    reason = `entity resolution confidence ${input.confidence.toFixed(2)} below threshold`;
  }
  return Object.freeze({ featureBlocked, reason });
}

export type JobPostingRow = {
  readonly postingId: string;
  readonly employerId: string;
  readonly fingerprint: string;
};

export function dedupeJobPostings(rows: readonly JobPostingRow[]): {
  readonly uniqueCount: number;
  readonly qualityPenaltyBps: number;
} {
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(`${row.employerId}:${row.fingerprint}`);
  }
  const dupes = rows.length - seen.size;
  const qualityPenaltyBps = dupes > 0 ? Math.min(2500, dupes * 400) : 0;
  return Object.freeze({ uniqueCount: seen.size, qualityPenaltyBps });
}

export function preserveSearchVintage(input: {
  readonly seriesId: string;
  readonly asOfDecisionTime: string;
  readonly revisedHistoryDropped: boolean;
}): { readonly vintagePreserved: boolean; readonly note: string } {
  return Object.freeze({
    vintagePreserved: input.revisedHistoryDropped,
    note: input.revisedHistoryDropped
      ? `historical vintage preserved for ${input.seriesId} at ${input.asOfDecisionTime}`
      : 'revision would mutate history',
  });
}
