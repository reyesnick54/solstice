import type { EventId } from './envelope.ts';

export const OUTBOX_STATES = ['PENDING', 'IN_FLIGHT', 'DELIVERED', 'DEAD_LETTER'] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

export const INBOX_STATES = ['RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type InboxState = (typeof INBOX_STATES)[number];

export type OutboxRecord = {
  readonly eventId: EventId;
  readonly envelopeJson: string;
  readonly deliveryState: OutboxState;
  readonly attemptCount: number;
  readonly nextAttemptAt: string;
  readonly lastAttemptAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorSafe: string | null;
  readonly lockedBy: string | null;
  readonly lockedAt: string | null;
  readonly deliveredAt: string | null;
  readonly createdAt: string;
};

export type InboxRecord = {
  readonly consumerId: string;
  readonly eventId: EventId;
  readonly firstSeenAt: string;
  readonly status: InboxState;
  readonly attemptCount: number;
  readonly completedAt: string | null;
  readonly lastErrorCode: string | null;
  readonly lastErrorSafe: string | null;
};

export type DeadLetterRecord = {
  readonly id: string;
  readonly eventId: EventId;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly consumerId: string | null;
  readonly attemptCount: number;
  readonly reasonCode: string;
  readonly reasonSafe: string;
  readonly errorClass?: string | null;
  readonly correlationId?: string | null;
  readonly requestId?: string | null;
  readonly lastAttemptAt?: string | null;
  readonly createdAt: string;
  readonly replayedAt: string | null;
};

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 5,
  baseDelayMs: 50,
  maxDelayMs: 2_000,
});

export function nextAttemptDelayMs(attemptCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const exp = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attemptCount - 1));
  return exp;
}

export function shouldDeadLetter(attemptCount: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return attemptCount >= policy.maxAttempts;
}

export function safeFailureMessage(error: unknown): { code: string; message: string } {
  if (error && typeof error === 'object' && 'reasonCode' in error) {
    const code = String((error as { reasonCode: string }).reasonCode);
    const message = error instanceof Error ? error.message : code;
    return { code, message: truncateSafe(message) };
  }
  if (error instanceof Error) {
    return { code: error.name || 'CONSUMER_FAILURE', message: truncateSafe(error.message) };
  }
  return { code: 'CONSUMER_FAILURE', message: 'consumer failed' };
}

function truncateSafe(value: string): string {
  return value.length > 240 ? `${value.slice(0, 240)}…` : value;
}
