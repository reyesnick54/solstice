import type { DurableEventEnvelope } from './envelope.ts';

/**
 * Portable publish adapter. The in-process transport is the simulation
 * default. A broker adapter may be added later without changing producers.
 */
export type EventTransport = {
  readonly name: string;
  publish(envelope: DurableEventEnvelope): Promise<void>;
};

export type InProcessHandler = (envelope: DurableEventEnvelope) => Promise<void> | void;

export class InProcessTransport implements EventTransport {
  readonly name = 'in-process-simulation';
  private readonly handlers: InProcessHandler[] = [];
  private readonly published: DurableEventEnvelope[] = [];

  subscribe(handler: InProcessHandler): void {
    this.handlers.push(handler);
  }

  async publish(envelope: DurableEventEnvelope): Promise<void> {
    this.published.push(envelope);
    for (const handler of this.handlers) {
      await handler(envelope);
    }
  }

  listPublished(): readonly DurableEventEnvelope[] {
    return this.published.slice();
  }
}
