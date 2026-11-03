/**
 * AS-OF joins on knowable time — not calendar event time alone.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { RevisionPolicy, TemporalObservation } from '../temporal-types.ts';
import { assertObservationKnowable, isKnowableAtDecision } from './leakage.ts';

export type AsOfSelection<T extends TemporalObservation> = {
  readonly selected: T | null;
  readonly candidatesConsidered: number;
};

function observationSortKey(row: TemporalObservation): readonly [number, number, string] {
  return [Date.parse(row.knowableAt), Date.parse(row.sourceEventTime), row.observationRef];
}

function compareObservations(a: TemporalObservation, b: TemporalObservation): number {
  const keyA = observationSortKey(a);
  const keyB = observationSortKey(b);
  for (let i = 0; i < 3; i += 1) {
    const left = keyA[i];
    const right = keyB[i];
    if (typeof left === 'number' && typeof right === 'number' && left !== right) {
      return left - right;
    }
    if (typeof left === 'string' && typeof right === 'string' && left !== right) {
      return left.localeCompare(right);
    }
  }
  return 0;
}

export function filterKnowableObservations(
  observations: readonly TemporalObservation[],
  decisionTime: UtcInstant,
): readonly TemporalObservation[] {
  return Object.freeze(
    observations.filter((row) => {
      const leak = assertObservationKnowable(row, decisionTime);
      return leak === null;
    }),
  );
}

export function selectAsOfLatest(
  observations: readonly TemporalObservation[],
  decisionTime: UtcInstant,
  revisionPolicy: RevisionPolicy,
): AsOfSelection<TemporalObservation> {
  const eligible = filterKnowableObservations(observations, decisionTime);
  if (eligible.length === 0) {
    return Object.freeze({ selected: null, candidatesConsidered: observations.length });
  }

  const sorted = [...eligible].sort(compareObservations);
  if (revisionPolicy === 'INITIAL_PUBLICATION_ONLY') {
    const initial = sorted.find((row) => row.revisionSequence === 0) ?? sorted[0] ?? null;
    return Object.freeze({ selected: initial, candidatesConsidered: observations.length });
  }

  const byPeriod = new Map<string, TemporalObservation>();
  for (const row of sorted) {
    const key = `${row.entityId}|${row.instrumentId ?? ''}|${row.periodEnd ?? row.sourceEventTime}|${row.kind}`;
    const existing = byPeriod.get(key);
    if (!existing || row.revisionSequence >= existing.revisionSequence) {
      byPeriod.set(key, row);
    }
  }
  const latest = [...byPeriod.values()].sort(compareObservations).at(-1) ?? null;
  return Object.freeze({ selected: latest, candidatesConsidered: observations.length });
}

export function selectAsOfSeries(
  observations: readonly TemporalObservation[],
  decisionTime: UtcInstant,
  revisionPolicy: RevisionPolicy,
): readonly TemporalObservation[] {
  const eligible = filterKnowableObservations(observations, decisionTime);
  const sorted = [...eligible].sort(compareObservations);
  if (revisionPolicy === 'INITIAL_PUBLICATION_ONLY') {
    const seen = new Set<string>();
    const out: TemporalObservation[] = [];
    for (const row of sorted) {
      const key = `${row.entityId}|${row.instrumentId ?? ''}|${row.periodEnd ?? row.sourceEventTime}|${row.kind}`;
      if (seen.has(key)) {
        continue;
      }
      if (row.revisionSequence === 0) {
        seen.add(key);
        out.push(row);
      }
    }
    return Object.freeze(out);
  }
  return Object.freeze(sorted);
}

export function asOfJoinOnSourceEvent(
  left: readonly TemporalObservation[],
  right: readonly TemporalObservation[],
  decisionTime: UtcInstant,
): readonly { readonly left: TemporalObservation; readonly right: TemporalObservation }[] {
  const leftEligible = filterKnowableObservations(left, decisionTime);
  const rightEligible = filterKnowableObservations(right, decisionTime);
  const rightByEvent = new Map<string, TemporalObservation>();
  for (const row of rightEligible) {
    rightByEvent.set(row.sourceEventTime, row);
  }
  const pairs: { left: TemporalObservation; right: TemporalObservation }[] = [];
  for (const l of leftEligible) {
    const r = rightByEvent.get(l.sourceEventTime);
    if (r && isKnowableAtDecision(decisionTime, r.knowableAt)) {
      pairs.push({ left: l, right: r });
    }
  }
  return Object.freeze(pairs);
}
