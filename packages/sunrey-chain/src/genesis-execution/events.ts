/**
 * Hash-chained launch events. Every event records sequence, actor,
 * class, input hash, result, evidence hash, and previous event hash.
 */

import { FIXED_LAUNCH_UTC, LAUNCH_EVENT_GENESIS_PRIOR, launchEventHashOf } from './hash.ts';
import type { LaunchActorKind, LaunchEvent, LaunchEventClass } from './types.ts';

export function emptyLaunchEvents(): readonly LaunchEvent[] {
  return Object.freeze([]);
}

export function appendLaunchEvent(
  events: readonly LaunchEvent[],
  input: {
    readonly actor: string;
    readonly actorKind: LaunchActorKind | 'SYSTEM';
    readonly eventClass: LaunchEventClass;
    readonly inputHash: string;
    readonly result: 'OK' | 'REJECTED' | 'INCIDENT';
    readonly evidenceHash: string;
  },
): readonly LaunchEvent[] {
  const previousEventHash = events.length === 0 ? LAUNCH_EVENT_GENESIS_PRIOR : events[events.length - 1]!.eventHash;
  const draft = {
    sequence: events.length + 1,
    actor: input.actor,
    actorKind: input.actorKind,
    eventClass: input.eventClass,
    inputHash: input.inputHash,
    result: input.result,
    evidenceHash: input.evidenceHash,
    previousEventHash,
    occurredAtUtc: FIXED_LAUNCH_UTC,
  };
  const entry: LaunchEvent = Object.freeze({ ...draft, eventHash: launchEventHashOf(draft) });
  return Object.freeze([...events, entry]);
}

export function verifyLaunchEvents(events: readonly LaunchEvent[]): boolean {
  let previous = LAUNCH_EVENT_GENESIS_PRIOR;
  for (const [index, entry] of events.entries()) {
    if (entry.sequence !== index + 1 || entry.previousEventHash !== previous) {
      return false;
    }
    if (launchEventHashOf(entry) !== entry.eventHash) {
      return false;
    }
    previous = entry.eventHash;
  }
  return true;
}
