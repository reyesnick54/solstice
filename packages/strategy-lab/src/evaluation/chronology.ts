import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ChronologicalObservation } from './manifest.ts';

export type ChronologyTieBreak = {
  readonly knowableAt: UtcInstant;
  readonly providerSequence: number;
  readonly observationId: string;
  readonly uncertaintyRecorded: boolean;
};

/**
 * Deterministic chronological ordering for evaluation processing.
 * Primary: knowableAt ascending.
 * Tie-break: providerSequence ascending when available.
 * Final tie-break: observationId lexicographic.
 */
export function sortObservationsChronologically(
  observations: readonly ChronologicalObservation[],
): readonly ChronologicalObservation[] {
  return Object.freeze(
    [...observations].sort((a, b) => {
      const knowableCmp = Date.parse(a.informationTime.knowableAt) - Date.parse(b.informationTime.knowableAt);
      if (knowableCmp !== 0) {
        return knowableCmp;
      }
      const seqCmp = a.providerSequence - b.providerSequence;
      if (seqCmp !== 0) {
        return seqCmp;
      }
      return a.observationId.localeCompare(b.observationId);
    }),
  );
}

export function uniqueDecisionTimes(
  observations: readonly ChronologicalObservation[],
  period: { readonly start: UtcInstant; readonly end: UtcInstant },
): readonly UtcInstant[] {
  const stamps = new Set<UtcInstant>();
  for (const row of observations) {
    const at = row.informationTime.sourceEventTime;
    if (at >= period.start && at <= period.end) {
      stamps.add(at);
    }
  }
  return Object.freeze([...stamps].sort((a, b) => Date.parse(a) - Date.parse(b)));
}

export function chronologyTieBreakReport(
  sorted: readonly ChronologicalObservation[],
): readonly ChronologyTieBreak[] {
  const out: ChronologyTieBreak[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (!prev || !current) {
      continue;
    }
    if (prev.informationTime.knowableAt === current.informationTime.knowableAt) {
      out.push(
        Object.freeze({
          knowableAt: current.informationTime.knowableAt,
          providerSequence: current.providerSequence,
          observationId: current.observationId,
          uncertaintyRecorded: prev.providerSequence === current.providerSequence,
        }),
      );
    }
  }
  return Object.freeze(out);
}
