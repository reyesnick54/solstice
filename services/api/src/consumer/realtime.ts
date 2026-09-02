/**
 * Wave 8 — controlled realtime consumer events (SSE).
 * Does not expose the internal event bus directly.
 */

export const REALTIME_EVENT_KINDS = [
  'TRANSACTION_FINALITY',
  'BALANCE_CHANGE',
  'CLAIM_STATUS',
  'ACTION_CENTER',
  'EXCHANGE_UPDATE',
  'PROVIDER_STATUS',
] as const;
export type RealtimeEventKind = (typeof REALTIME_EVENT_KINDS)[number];

export type RealtimeEvent = {
  readonly schema: 'sunrey.consumer.realtime-event.v1';
  readonly eventId: string;
  readonly kind: RealtimeEventKind;
  readonly occurredAt: string;
  readonly subjectId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly simulationOnly: true;
};

export type RealtimeStreamSnapshot = {
  readonly schema: 'sunrey.consumer.realtime-stream.v1';
  readonly requestId: string;
  readonly after: number;
  readonly events: readonly RealtimeEvent[];
  readonly productionActive: false;
};

let eventSeq = 0;

export function createRealtimeEvent(input: {
  readonly kind: RealtimeEventKind;
  readonly subjectId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt?: string;
}): RealtimeEvent {
  eventSeq += 1;
  return Object.freeze({
    schema: 'sunrey.consumer.realtime-event.v1',
    eventId: `rt_${eventSeq}`,
    kind: input.kind,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    subjectId: input.subjectId,
    payload: Object.freeze({ ...input.payload }),
    simulationOnly: true,
  });
}

export function formatRealtimeSse(events: readonly RealtimeEvent[]): string {
  return events.map((event) => `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`).join('');
}

export function heartbeatSse(): string {
  return `: heartbeat ${new Date().toISOString()}\n\n`;
}

export function buildRealtimeSnapshot(input: {
  readonly requestId: string;
  readonly subjectId: string;
  readonly after: number;
  readonly actionCenterCount?: number;
}): RealtimeStreamSnapshot {
  const events: RealtimeEvent[] = [];
  if (input.actionCenterCount !== undefined && input.actionCenterCount > 0) {
    events.push(
      createRealtimeEvent({
        kind: 'ACTION_CENTER',
        subjectId: input.subjectId,
        payload: Object.freeze({ pendingCount: input.actionCenterCount }),
      }),
    );
  }
  events.push(
    createRealtimeEvent({
      kind: 'PROVIDER_STATUS',
      subjectId: input.subjectId,
      payload: Object.freeze({ environment: 'simulation', liveConnectivity: false }),
    }),
  );
  return Object.freeze({
    schema: 'sunrey.consumer.realtime-stream.v1',
    requestId: input.requestId,
    after: input.after,
    events: Object.freeze(events),
    productionActive: false,
  });
}
