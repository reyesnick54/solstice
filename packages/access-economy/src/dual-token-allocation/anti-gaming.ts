/**
 * ACCESS-15 anti-gaming controls.
 * Uses canonical identity and custody truth — no identity scoring.
 */

import type { SubjectRef } from '../ids.ts';
import type { BalanceCheckpoint } from './types.ts';
import { instantMs } from './twab.ts';

export type AntiGamingFlags = {
  readonly washTransferSuspected: boolean;
  readonly selfTransferLoopSuspected: boolean;
  readonly rapidCyclingSuspected: boolean;
  readonly epochBoundarySpikeSuspected: boolean;
  readonly duplicateBalanceSource: boolean;
};

export type AntiGamingResult = {
  readonly subjectRef: SubjectRef;
  readonly flags: AntiGamingFlags;
  readonly excludedFromAllocation: boolean;
  readonly reasonCode: string | null;
};

const RAPID_CYCLE_THRESHOLD = 4;
const BOUNDARY_SPIKE_RATIO_BPS = 5_000n;

function balanceTotal(checkpoint: BalanceCheckpoint): bigint {
  return (
    checkpoint.sunReyLiquid +
    checkpoint.moonReyLiquid +
    checkpoint.sunReyLocked +
    checkpoint.moonReyLocked +
    checkpoint.sunReyEscrowed +
    checkpoint.moonReyEscrowed
  );
}

export function evaluateAntiGaming(
  subjectRef: SubjectRef,
  checkpoints: readonly BalanceCheckpoint[],
  knownCustodySources: readonly string[],
): AntiGamingResult {
  const flags: AntiGamingFlags = Object.freeze({
    washTransferSuspected: false,
    selfTransferLoopSuspected: false,
    rapidCyclingSuspected: false,
    epochBoundarySpikeSuspected: false,
    duplicateBalanceSource: knownCustodySources.length > 1,
  });

  if (checkpoints.length < 2) {
    return Object.freeze({
      subjectRef,
      flags,
      excludedFromAllocation: flags.duplicateBalanceSource,
      reasonCode: flags.duplicateBalanceSource ? 'DUPLICATE_CUSTODY_SOURCE' : null,
    });
  }

  let directionChanges = 0;
  let previousDelta = 0n;
  for (let index = 1; index < checkpoints.length; index += 1) {
    const before = balanceTotal(checkpoints[index - 1]!);
    const after = balanceTotal(checkpoints[index]!);
    const delta = after - before;
    if (delta !== 0n && previousDelta !== 0n && (delta > 0n) !== (previousDelta > 0n)) {
      directionChanges += 1;
    }
    previousDelta = delta;
  }

  const rapidCycling = directionChanges >= RAPID_CYCLE_THRESHOLD;
  const first = checkpoints[0]!;
  const last = checkpoints[checkpoints.length - 1]!;
  const firstTotal = balanceTotal(first);
  const lastTotal = balanceTotal(last);
  const boundarySpike =
    firstTotal > 0n &&
    ((lastTotal * 10_000n) / firstTotal > 10_000n + BOUNDARY_SPIKE_RATIO_BPS ||
      (firstTotal * 10_000n) / lastTotal > 10_000n + BOUNDARY_SPIKE_RATIO_BPS);

  const resolvedFlags: AntiGamingFlags = Object.freeze({
    ...flags,
    rapidCyclingSuspected: rapidCycling,
    epochBoundarySpikeSuspected: boundarySpike,
    washTransferSuspected: rapidCycling && checkpoints.length >= 4,
    selfTransferLoopSuspected: rapidCycling && directionChanges >= RAPID_CYCLE_THRESHOLD + 2,
  });

  const excluded =
    resolvedFlags.duplicateBalanceSource ||
    resolvedFlags.selfTransferLoopSuspected ||
    resolvedFlags.duplicateBalanceSource;

  return Object.freeze({
    subjectRef,
    flags: resolvedFlags,
    excludedFromAllocation: excluded,
    reasonCode: excluded
      ? resolvedFlags.duplicateBalanceSource
        ? 'DUPLICATE_CUSTODY_SOURCE'
        : 'SELF_TRANSFER_LOOP_SUSPECTED'
      : null,
  });
}

export function deduplicateCustodySources(sources: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(sources)]);
}

export function msBetween(left: BalanceCheckpoint, right: BalanceCheckpoint): bigint {
  const delta = instantMs(right.observedAt) - instantMs(left.observedAt);
  return delta < 0n ? -delta : delta;
}
