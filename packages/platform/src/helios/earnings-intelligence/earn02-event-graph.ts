import type { EarningsCalendarEvent, EarningsEventGraphNode } from './types.ts';

export const EARN02_EVENT_GRAPH_MODULE =
  'packages/platform/src/helios/earnings-intelligence/earn02-event-graph.ts' as const;

export function buildEarningsEventGraph(
  calendar: readonly EarningsCalendarEvent[],
): readonly EarningsEventGraphNode[] {
  const nodes: EarningsEventGraphNode[] = [];
  for (const event of calendar) {
    nodes.push(
      Object.freeze({
        nodeId: `${event.eventId}:calendar`,
        eventId: event.eventId,
        layer: 'CALENDAR',
        knowableAt: event.scheduledAt,
      }),
      Object.freeze({
        nodeId: `${event.eventId}:filing`,
        eventId: event.eventId,
        layer: 'FILING',
        knowableAt: event.reportKnowableAt,
      }),
    );
  }
  return Object.freeze(nodes);
}
