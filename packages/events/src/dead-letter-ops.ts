import type { DeadLetterRecord } from './delivery.ts';
import type { DeadLetterStore } from './dispatcher.ts';
import type { JobRecord, JobStore } from './jobs.ts';
import type { RetryClass } from './retry.ts';
import type { OutboundWebhookDelivery, OutboundWebhookStore } from './webhooks.ts';

/**
 * Internal operations surface for failed events, jobs, and webhook
 * deliveries. Privileged replay is not a public API.
 */

export const PUBLIC_REPLAY_EXPOSED = false as const;

export type InternalOperator = {
  readonly actorId: string;
  readonly role: 'INTERNAL_OPS';
};

export type DeadLetterView = {
  readonly id: string;
  readonly kind: 'EVENT' | 'JOB' | 'OUTBOUND_WEBHOOK';
  readonly referenceId: string;
  readonly eventType: string | null;
  readonly attemptCount: number;
  readonly errorClass: RetryClass | string | null;
  readonly lastAttemptAt: string | null;
  readonly correlationId: string | null;
  readonly requestId: string | null;
  readonly reasonSafe: string;
  readonly replayedAt: string | null;
};

export type DeadLetterOpsPorts = {
  readonly events: DeadLetterStore;
  readonly jobs?: JobStore;
  readonly outbound?: OutboundWebhookStore;
};

export class PublicReplayRefusedError extends Error {
  readonly reasonCode = 'PUBLIC_REPLAY_FORBIDDEN';
  readonly retryClass = 'NON_RETRYABLE' as const;

  constructor() {
    super('dead-letter replay is an internal operations action');
    this.name = 'PublicReplayRefusedError';
  }
}

export function refusePublicReplay(): never {
  throw new PublicReplayRefusedError();
}

export function assertInternalOperator(actor: InternalOperator | undefined): InternalOperator {
  if (!actor || actor.role !== 'INTERNAL_OPS' || actor.actorId.length === 0) {
    refusePublicReplay();
  }
  return actor;
}

export class DeadLetterOps {
  private readonly ports: DeadLetterOpsPorts;

  constructor(ports: DeadLetterOpsPorts) {
    this.ports = ports;
  }

  async list(actor: InternalOperator | undefined): Promise<readonly DeadLetterView[]> {
    assertInternalOperator(actor);
    const views: DeadLetterView[] = [];
    for (const row of await this.ports.events.list()) {
      views.push(fromEvent(row));
    }
    if (this.ports.jobs) {
      for (const row of await this.ports.jobs.list('DEAD_LETTER')) {
        views.push(fromJob(row));
      }
    }
    if (this.ports.outbound) {
      for (const row of await this.ports.outbound.listDeliveries()) {
        if (row.state === 'DEAD_LETTER' || row.state === 'DISABLED') {
          views.push(fromOutbound(row));
        }
      }
    }
    return views;
  }

  async inspect(actor: InternalOperator | undefined, referenceId: string): Promise<DeadLetterView | undefined> {
    assertInternalOperator(actor);
    return (await this.list(actor)).find((row) => row.referenceId === referenceId || row.id === referenceId);
  }

  async replay(actor: InternalOperator | undefined, input: { readonly kind: DeadLetterView['kind']; readonly referenceId: string; readonly now: string }): Promise<void> {
    assertInternalOperator(actor);
    if (input.kind === 'EVENT') {
      await this.ports.events.markReplayed(input.referenceId, input.now);
      return;
    }
    if (input.kind === 'JOB' && this.ports.jobs) {
      await this.ports.jobs.replay(input.referenceId, input.now);
      return;
    }
    throw new Error('replay is not available for this dead-letter kind');
  }
}

function fromEvent(row: DeadLetterRecord): DeadLetterView {
  return {
    id: row.id,
    kind: 'EVENT',
    referenceId: row.eventId,
    eventType: row.eventType,
    attemptCount: row.attemptCount,
    errorClass: row.errorClass ?? null,
    lastAttemptAt: row.createdAt,
    correlationId: row.correlationId ?? null,
    requestId: row.requestId ?? null,
    reasonSafe: row.reasonSafe,
    replayedAt: row.replayedAt,
  };
}

function fromJob(row: JobRecord): DeadLetterView {
  return {
    id: row.jobId,
    kind: 'JOB',
    referenceId: row.jobId,
    eventType: row.jobType,
    attemptCount: row.attemptCount,
    errorClass: row.lastErrorClass,
    lastAttemptAt: row.lastAttemptAt,
    correlationId: row.correlationId,
    requestId: row.requestId,
    reasonSafe: row.lastErrorSafe ?? 'job dead-lettered',
    replayedAt: null,
  };
}

function fromOutbound(row: OutboundWebhookDelivery): DeadLetterView {
  return {
    id: row.deliveryId,
    kind: 'OUTBOUND_WEBHOOK',
    referenceId: row.deliveryId,
    eventType: row.eventType,
    attemptCount: row.attemptCount,
    errorClass: row.lastErrorClass,
    lastAttemptAt: row.lastAttemptAt,
    correlationId: row.correlationId,
    requestId: row.requestId,
    reasonSafe: row.lastErrorSafe ?? 'webhook delivery failed',
    replayedAt: null,
  };
}
