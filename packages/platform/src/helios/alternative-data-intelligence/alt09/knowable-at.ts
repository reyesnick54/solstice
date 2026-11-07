/**
 * ALT09 point-in-time rules — applications are invisible until publication.
 */

import type { UtcInstant } from '@solstice/domain';

import type { PatentObservation } from './types.ts';

function parseMs(instant: UtcInstant | null): number | null {
  if (!instant) {
    return null;
  }
  const ms = Date.parse(instant);
  return Number.isFinite(ms) ? ms : null;
}

/** Latest event that makes patent metadata provider-knowable (publication floor for visibility). */
export function computePatentKnowableAt(patent: {
  readonly publicationDate: UtcInstant | null;
  readonly grantDate: UtcInstant | null;
  readonly assignmentDate: UtcInstant | null;
}): UtcInstant | null {
  const publicationMs = parseMs(patent.publicationDate);
  if (publicationMs === null) {
    return null;
  }
  const candidates = [publicationMs];
  const grantMs = parseMs(patent.grantDate);
  if (grantMs !== null) {
    candidates.push(grantMs);
  }
  const assignmentMs = parseMs(patent.assignmentDate);
  if (assignmentMs !== null) {
    candidates.push(assignmentMs);
  }
  return new Date(Math.max(...candidates)).toISOString() as UtcInstant;
}

export function isPatentVisibleAt(evaluationTimeUtc: UtcInstant, patent: PatentObservation): boolean {
  const evalMs = Date.parse(evaluationTimeUtc);
  const knowableMs = Date.parse(patent.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowableMs)) {
    return false;
  }
  if (evalMs < knowableMs) {
    return false;
  }
  const publicationMs = parseMs(patent.publicationDate);
  if (publicationMs === null) {
    return false;
  }
  return evalMs >= publicationMs;
}

export function filterKnowablePatents(
  evaluationTimeUtc: UtcInstant,
  patents: readonly PatentObservation[],
): readonly PatentObservation[] {
  return Object.freeze(patents.filter((row) => isPatentVisibleAt(evaluationTimeUtc, row)));
}

export function assertNoPatentLeakage(
  evaluationTimeUtc: UtcInstant,
  patents: readonly PatentObservation[],
): void {
  for (const patent of patents) {
    if (!isPatentVisibleAt(evaluationTimeUtc, patent)) {
      throw new Error(
        `patent ${patent.patentId} not knowable at ${evaluationTimeUtc} (publication=${patent.publicationDate})`,
      );
    }
    const publicationMs = parseMs(patent.publicationDate);
    const filingMs = parseMs(patent.filingDate);
    if (publicationMs !== null && filingMs !== null && publicationMs < filingMs) {
      throw new Error(`patent ${patent.patentId} publication precedes filing`);
    }
  }
}
