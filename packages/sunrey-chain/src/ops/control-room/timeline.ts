import { safeCorrelationRefs } from './correlation.ts';
import type { IncidentTimelineEvent, SafeCorrelationRefs, TimelineActor, TimelineEventKind } from './types.ts';

export function appendTimelineEvent(
  events: readonly IncidentTimelineEvent[],
  input: {
    readonly atUtc: string;
    readonly kind: TimelineEventKind;
    readonly actor: TimelineActor;
    readonly summary: string;
    readonly correlationRefs?: SafeCorrelationRefs;
  },
): readonly IncidentTimelineEvent[] {
  const next: IncidentTimelineEvent = Object.freeze({
    sequence: BigInt(events.length + 1),
    atUtc: input.atUtc,
    kind: input.kind,
    actor: input.actor,
    summary: input.summary,
    correlationRefs: safeCorrelationRefs(input.correlationRefs ?? {}),
  });
  return Object.freeze([...events, next]);
}

export function orderedTimeline(events: readonly IncidentTimelineEvent[]): readonly IncidentTimelineEvent[] {
  return Object.freeze(
    [...events].sort((left, right) => {
      if (left.atUtc === right.atUtc) {
        return left.sequence < right.sequence ? -1 : left.sequence > right.sequence ? 1 : 0;
      }
      return left.atUtc < right.atUtc ? -1 : 1;
    }),
  );
}
