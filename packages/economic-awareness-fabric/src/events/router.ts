export type FabricEventKind =
  | 'provider.ingested'
  | 'observation.normalized'
  | 'entity.resolved'
  | 'duplicate.detected'
  | 'corroboration.recorded'
  | 'evidence.proposed'
  | 'fact.proposed'
  | 'claim.proposed';

export type FabricEvent = {
  readonly eventId: string;
  readonly kind: FabricEventKind;
  readonly occurredAtUtc: string;
  readonly correlationId: string;
  readonly payloadDigest: string;
  readonly economicDomain: string;
};

export type FabricEventHandler = (event: FabricEvent) => void;

export type FabricEventRouter = {
  publish(event: FabricEvent): void;
  subscribe(kind: FabricEventKind, handler: FabricEventHandler): () => void;
  list(kind?: FabricEventKind): readonly FabricEvent[];
};

export function createFabricEventRouter(): FabricEventRouter {
  const events: FabricEvent[] = [];
  const handlers = new Map<FabricEventKind, Set<FabricEventHandler>>();

  return {
    publish(event) {
      events.push(Object.freeze({ ...event }));
      const kindHandlers = handlers.get(event.kind);
      if (kindHandlers) {
        for (const handler of kindHandlers) {
          handler(event);
        }
      }
    },
    subscribe(kind, handler) {
      let set = handlers.get(kind);
      if (!set) {
        set = new Set();
        handlers.set(kind, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
    list(kind) {
      if (!kind) return Object.freeze([...events]);
      return Object.freeze(events.filter((e) => e.kind === kind));
    },
  };
}
