/**
 * Repeatable shadow burn-in framework.
 *
 * Does not claim a duration that has not actually executed.
 * Fake elapsed-duration claims without clock metadata are unavailable.
 */

import type { PregenesisBurnInReport, PregenesisHealthWindow } from './types.ts';

export type BurnInInput = {
  readonly profile: 'bounded' | 'extended';
  readonly startedAtUtc: string;
  readonly endedAtUtc: string;
  readonly blockCount: string;
  readonly epochCount?: string;
};

export function healthWindowFromClock(input: BurnInInput): PregenesisHealthWindow {
  const started = Date.parse(input.startedAtUtc);
  const ended = Date.parse(input.endedAtUtc);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    throw new TypeError('burn-in requires actual start/end UTC metadata');
  }
  return Object.freeze({
    kind: ended === started ? 'BLOCK_EPOCH_COUNT' : 'ELAPSED_DURATION',
    blockCount: input.blockCount,
    epochCount: input.epochCount ?? '1',
    startedAtUtc: input.startedAtUtc,
    endedAtUtc: input.endedAtUtc,
    elapsedMs: String(ended - started),
    claimedWithoutClock: false,
  });
}

export function rejectFakeElapsedDurationClaim(claim?: { readonly claimedMs: string; readonly startedAtUtc?: string; readonly endedAtUtc?: string }): void {
  if (!claim) {
    return;
  }
  if (!claim.startedAtUtc || !claim.endedAtUtc) {
    throw new TypeError('fake elapsed-duration claim unavailable');
  }
  const started = Date.parse(claim.startedAtUtc);
  const ended = Date.parse(claim.endedAtUtc);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) {
    throw new TypeError('fake elapsed-duration claim unavailable');
  }
  const actual = String(ended - started);
  if (actual !== claim.claimedMs) {
    throw new TypeError('fake elapsed-duration claim unavailable');
  }
}

export function boundedBurnIn(input: BurnInInput): PregenesisBurnInReport {
  const window = healthWindowFromClock(input);
  return Object.freeze({
    schemaVersion: 1,
    runId: `pregenesis_burnin_${input.startedAtUtc}`,
    profile: input.profile,
    window,
    completed: true,
    durationClaimedWithoutExecution: false,
    notes:
      input.profile === 'bounded'
        ? 'CI bounded shadow qualification. Block/epoch window only. No invented soak duration.'
        : 'Extended burn-in records actual start/end metadata from this execution only.',
  });
}
