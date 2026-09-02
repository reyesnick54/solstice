import type { DurableEventEnvelope } from './envelope.ts';
import { outboxRecordFromEnvelope } from './memory-outbox.ts';
import type { OutboxStore } from './dispatcher.ts';
import type { EventTransport } from './transport.ts';
import { OutboxDispatcher, type DeadLetterStore, type DispatcherClock } from './dispatcher.ts';

/**
 * Production-ready event bus abstraction. Simulation uses a durable local
 * outbox-backed implementation; a Kafka (or similar) adapter can implement
 * the same interface without changing producers.
 *
 * InProcessTransport alone is not a production design — publish always
 * persists to the outbox first.
 */
export type EventBus = {
  readonly name: string;
  publish(envelope: DurableEventEnvelope): Promise<void>;
  dispatchPending?(): Promise<{ published: number; deadLettered: number; retried: number }>;
};

export type DurableLocalEventBusOptions = {
  readonly outbox: OutboxStore;
  readonly transport: EventTransport;
  readonly deadLetters?: DeadLetterStore;
  readonly clock: DispatcherClock;
  readonly workerId?: string;
  readonly autoDispatch?: boolean;
};

/**
 * Durable local event bus: transactional outbox + at-least-once dispatch.
 * Compatible with later Kafka migration by swapping the transport adapter.
 */
export class DurableLocalEventBus implements EventBus {
  readonly name = 'durable-local-outbox';
  private readonly outbox: OutboxStore;
  private readonly dispatcher: OutboxDispatcher | null;
  private readonly clock: DispatcherClock;
  private readonly autoDispatch: boolean;

  constructor(options: DurableLocalEventBusOptions) {
    this.outbox = options.outbox;
    this.clock = options.clock;
    this.autoDispatch = options.autoDispatch ?? false;
    if (options.deadLetters) {
      this.dispatcher = new OutboxDispatcher(options.outbox, options.deadLetters, options.transport, {
        workerId: options.workerId ?? 'durable-local-bus',
        clock: options.clock,
      });
    } else {
      this.dispatcher = null;
    }
  }

  async publish(envelope: DurableEventEnvelope): Promise<void> {
    const now = this.clock.now();
    await this.outbox.enqueue(outboxRecordFromEnvelope(envelope, now));
    if (this.autoDispatch && this.dispatcher) {
      await this.dispatcher.dispatchOnce();
    }
  }

  async dispatchPending(): Promise<{ published: number; deadLettered: number; retried: number }> {
    if (!this.dispatcher) {
      return { published: 0, deadLettered: 0, retried: 0 };
    }
    return this.dispatcher.dispatchOnce();
  }
}
