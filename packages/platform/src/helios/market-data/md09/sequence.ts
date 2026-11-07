import type { Md09SynchronizationScheme } from '@solstice/external-data';
import type { Md09SequenceIntegrity } from './types.ts';

const INITIAL_INTEGRITY: Md09SequenceIntegrity = Object.freeze({
  lastSequence: null,
  gapDetected: false,
  resyncRequired: false,
  checksumVerified: null,
  snapshotAnchorId: null,
});

export function applyMd09SequenceStep(
  prior: Md09SequenceIntegrity,
  scheme: Md09SynchronizationScheme,
  nextSequence: number | null,
  options?: Readonly<{ readonly isSnapshot?: boolean; readonly snapshotAnchorId?: string | null }>,
): Md09SequenceIntegrity {
  if (scheme.sequenceField === 'none' || nextSequence === null) {
    return Object.freeze({
      ...prior,
      lastSequence: prior.lastSequence,
      gapDetected: false,
      resyncRequired: false,
      checksumVerified: scheme.checksumSupported ? prior.checksumVerified : null,
      snapshotAnchorId: options?.isSnapshot
        ? (options.snapshotAnchorId ?? String(nextSequence ?? 'snapshot'))
        : prior.snapshotAnchorId,
    });
  }

  let gapDetected = prior.gapDetected;
  let resyncRequired = prior.resyncRequired;
  if (prior.lastSequence !== null && scheme.sequencePolicy.strictMonotonic) {
    const expected = prior.lastSequence + 1;
    if (nextSequence > expected) {
      gapDetected = true;
      if (scheme.sequencePolicy.resyncOnGap) {
        resyncRequired = true;
      }
    }
    if (nextSequence === prior.lastSequence && scheme.sequencePolicy.dedupeDuplicates) {
      return prior;
    }
  }

  return Object.freeze({
    lastSequence: nextSequence,
    gapDetected,
    resyncRequired,
    checksumVerified: scheme.checksumSupported ? true : null,
    snapshotAnchorId: options?.isSnapshot
      ? (options.snapshotAnchorId ?? String(nextSequence))
      : prior.snapshotAnchorId,
  });
}

export function initialMd09SequenceIntegrity(): Md09SequenceIntegrity {
  return INITIAL_INTEGRITY;
}
