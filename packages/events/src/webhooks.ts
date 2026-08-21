import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { DEFAULT_RETRY_POLICY, nextAttemptDelayMs, type RetryPolicy } from './delivery.ts';
import { classifyFailure, shouldRetry, type RetryClass } from './retry.ts';
import type { TraceContext } from './trace.ts';

/**
 * Inbound provider webhooks and outbound SunRey developer webhooks.
 *
 * Inbound: each provider adapter supplies verification. This file does
 * not invent a fake provider signature scheme.
 *
 * Outbound: durable subscription + signed delivery. Replay and secret
 * management stay internal. Not a public unauthenticated API.
 */

export const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;
export const OUTBOUND_WEBHOOK_SCHEME = 'sunrey-webhook-v1' as const;
export const DEFAULT_OUTBOUND_FAILURE_THRESHOLD = 8;

export type ProviderWebhookVerifier = {
  readonly providerId: string;
  verify(input: {
    readonly headers: Readonly<Record<string, string>>;
    readonly rawBody: string;
    readonly receivedAt: string;
  }): ProviderWebhookVerification;
};

export type ProviderWebhookVerification =
  | {
      readonly ok: true;
      readonly eventType: string;
      readonly providerEventId: string;
      readonly occurredAt: string;
    }
  | {
      readonly ok: false;
      readonly code: 'INVALID_SIGNATURE' | 'STALE_TIMESTAMP' | 'SCHEMA_INVALID' | 'UNKNOWN_PROVIDER';
    };

export type InboundWebhookReceipt = {
  readonly receiptId: string;
  readonly providerId: string;
  readonly providerEventId: string;
  readonly eventType: string;
  readonly receivedAt: string;
  readonly rawBodyHash: string;
  readonly status: 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';
  readonly rejectCode: string | null;
  readonly correlationId: string;
  readonly requestId: string | null;
  readonly processedAt: string | null;
};

export type InboundHttpAck =
  | { readonly status: 202; readonly receiptId: string; readonly duplicate: boolean }
  | { readonly status: 401 | 400; readonly code: string };

export type InboundWebhookStore = {
  getByProviderEvent(providerId: string, providerEventId: string): Promise<InboundWebhookReceipt | undefined>;
  insert(receipt: InboundWebhookReceipt): Promise<void>;
  markProcessed(receiptId: string, now: string): Promise<void>;
  list(): Promise<readonly InboundWebhookReceipt[]>;
  snapshot(): Promise<readonly InboundWebhookReceipt[]>;
  restore(rows: readonly InboundWebhookReceipt[]): Promise<void>;
};

export class InMemoryInboundWebhookStore implements InboundWebhookStore {
  private rows = new Map<string, InboundWebhookReceipt>();

  async getByProviderEvent(
    providerId: string,
    providerEventId: string,
  ): Promise<InboundWebhookReceipt | undefined> {
    return [...this.rows.values()].find(
      (row) => row.providerId === providerId && row.providerEventId === providerEventId,
    );
  }

  async insert(receipt: InboundWebhookReceipt): Promise<void> {
    this.rows.set(receipt.receiptId, receipt);
  }

  async markProcessed(receiptId: string, now: string): Promise<void> {
    const row = this.rows.get(receiptId);
    if (!row) {
      return;
    }
    this.rows.set(receiptId, { ...row, processedAt: now });
  }

  async list(): Promise<readonly InboundWebhookReceipt[]> {
    return [...this.rows.values()];
  }

  async snapshot(): Promise<readonly InboundWebhookReceipt[]> {
    return [...this.rows.values()];
  }

  async restore(rows: readonly InboundWebhookReceipt[]): Promise<void> {
    this.rows = new Map(rows.map((row) => [row.receiptId, row]));
  }
}

export class InboundWebhookReceiver {
  private readonly store: InboundWebhookStore;
  private readonly verifiers = new Map<string, ProviderWebhookVerifier>();
  private readonly now: () => string;

  constructor(store: InboundWebhookStore, now: () => string) {
    this.store = store;
    this.now = now;
  }

  registerVerifier(verifier: ProviderWebhookVerifier): void {
    this.verifiers.set(verifier.providerId, verifier);
  }

  async receive(input: {
    readonly providerId: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly rawBody: string;
    readonly trace?: TraceContext;
  }): Promise<{ ack: InboundHttpAck; receipt: InboundWebhookReceipt | undefined }> {
    const verifier = this.verifiers.get(input.providerId);
    const receivedAt = this.now();
    if (!verifier) {
      const receipt = await this.reject(input, 'UNKNOWN_PROVIDER', receivedAt);
      return { ack: { status: 401, code: 'UNKNOWN_PROVIDER' }, receipt };
    }
    const verified = verifier.verify({
      headers: input.headers,
      rawBody: input.rawBody,
      receivedAt,
    });
    if (!verified.ok) {
      const receipt = await this.reject(input, verified.code, receivedAt);
      const status = verified.code === 'INVALID_SIGNATURE' || verified.code === 'UNKNOWN_PROVIDER' ? 401 : 400;
      return { ack: { status, code: verified.code }, receipt };
    }
    const existing = await this.store.getByProviderEvent(input.providerId, verified.providerEventId);
    if (existing) {
      return {
        ack: { status: 202, receiptId: existing.receiptId, duplicate: true },
        receipt: existing,
      };
    }
    const receipt: InboundWebhookReceipt = {
      receiptId: `whi_${randomUUID()}`,
      providerId: input.providerId,
      providerEventId: verified.providerEventId,
      eventType: verified.eventType,
      receivedAt,
      rawBodyHash: sha256Hex(input.rawBody),
      status: 'ACCEPTED',
      rejectCode: null,
      correlationId: input.trace?.correlationId ?? verified.providerEventId,
      requestId: input.trace?.requestId ?? null,
      processedAt: null,
    };
    await this.store.insert(receipt);
    return { ack: { status: 202, receiptId: receipt.receiptId, duplicate: false }, receipt };
  }

  async markProcessed(receiptId: string): Promise<void> {
    await this.store.markProcessed(receiptId, this.now());
  }

  private async reject(
    input: { readonly providerId: string; readonly rawBody: string; readonly trace?: TraceContext },
    code: string,
    receivedAt: string,
  ): Promise<InboundWebhookReceipt> {
    const receipt: InboundWebhookReceipt = {
      receiptId: `whi_${randomUUID()}`,
      providerId: input.providerId,
      providerEventId: `rejected:${sha256Hex(input.rawBody).slice(0, 16)}`,
      eventType: 'rejected',
      receivedAt,
      rawBodyHash: sha256Hex(input.rawBody),
      status: 'REJECTED',
      rejectCode: code,
      correlationId: input.trace?.correlationId ?? input.providerId,
      requestId: input.trace?.requestId ?? null,
      processedAt: receivedAt,
    };
    await this.store.insert(receipt);
    return receipt;
  }
}

export type OutboundWebhookSubscription = {
  readonly subscriptionId: string;
  readonly ownerId: string;
  readonly destinationUrl: string;
  readonly secretRef: string;
  readonly eventFilter: readonly string[];
  readonly active: boolean;
  readonly consecutiveFailures: number;
  readonly failureThreshold: number;
  readonly disabledAt: string | null;
  readonly createdAt: string;
};

export type OutboundWebhookDelivery = {
  readonly deliveryId: string;
  readonly subscriptionId: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly attemptCount: number;
  readonly state: 'PENDING' | 'DELIVERED' | 'RETRYING' | 'DEAD_LETTER' | 'DISABLED';
  readonly lastAttemptAt: string | null;
  readonly nextAttemptAt: string;
  readonly lastErrorClass: RetryClass | null;
  readonly lastErrorSafe: string | null;
  readonly bodyHash: string;
  readonly signature: string;
  readonly correlationId: string;
  readonly requestId: string | null;
  readonly createdAt: string;
};

export type OutboundWebhookStore = {
  putSubscription(row: OutboundWebhookSubscription): Promise<void>;
  getSubscription(subscriptionId: string): Promise<OutboundWebhookSubscription | undefined>;
  listSubscriptions(ownerId?: string): Promise<readonly OutboundWebhookSubscription[]>;
  putDelivery(row: OutboundWebhookDelivery): Promise<void>;
  getDelivery(deliveryId: string): Promise<OutboundWebhookDelivery | undefined>;
  listDeliveries(subscriptionId?: string): Promise<readonly OutboundWebhookDelivery[]>;
  snapshot(): Promise<{
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }>;
  restore(snapshot: {
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }): Promise<void>;
};

export class InMemoryOutboundWebhookStore implements OutboundWebhookStore {
  private subscriptions = new Map<string, OutboundWebhookSubscription>();
  private deliveries = new Map<string, OutboundWebhookDelivery>();

  async putSubscription(row: OutboundWebhookSubscription): Promise<void> {
    this.subscriptions.set(row.subscriptionId, row);
  }

  async getSubscription(subscriptionId: string): Promise<OutboundWebhookSubscription | undefined> {
    return this.subscriptions.get(subscriptionId);
  }

  async listSubscriptions(ownerId?: string): Promise<readonly OutboundWebhookSubscription[]> {
    return [...this.subscriptions.values()].filter((row) => !ownerId || row.ownerId === ownerId);
  }

  async putDelivery(row: OutboundWebhookDelivery): Promise<void> {
    this.deliveries.set(row.deliveryId, row);
  }

  async getDelivery(deliveryId: string): Promise<OutboundWebhookDelivery | undefined> {
    return this.deliveries.get(deliveryId);
  }

  async listDeliveries(subscriptionId?: string): Promise<readonly OutboundWebhookDelivery[]> {
    return [...this.deliveries.values()].filter((row) => !subscriptionId || row.subscriptionId === subscriptionId);
  }

  async snapshot(): Promise<{
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }> {
    return {
      subscriptions: [...this.subscriptions.values()],
      deliveries: [...this.deliveries.values()],
    };
  }

  async restore(snapshot: {
    readonly subscriptions: readonly OutboundWebhookSubscription[];
    readonly deliveries: readonly OutboundWebhookDelivery[];
  }): Promise<void> {
    this.subscriptions = new Map(snapshot.subscriptions.map((row) => [row.subscriptionId, row]));
    this.deliveries = new Map(snapshot.deliveries.map((row) => [row.deliveryId, row]));
  }
}

export type WebhookSecretResolver = (secretRef: string) => string | undefined;

export type OutboundWebhookTransport = (input: {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}) => Promise<{ readonly ok: boolean; readonly status?: number }>;

export class OutboundWebhookService {
  private readonly store: OutboundWebhookStore;
  private readonly secrets: WebhookSecretResolver;
  private readonly transport: OutboundWebhookTransport;
  private readonly clock: { now(): string; nowMs(): number };
  private readonly policy: RetryPolicy;
  private readonly authorized = new Set<string>();

  constructor(input: {
    readonly store: OutboundWebhookStore;
    readonly secrets: WebhookSecretResolver;
    readonly transport: OutboundWebhookTransport;
    readonly clock: { now(): string; nowMs(): number };
    readonly policy?: RetryPolicy;
  }) {
    this.store = input.store;
    this.secrets = input.secrets;
    this.transport = input.transport;
    this.clock = input.clock;
    this.policy = input.policy ?? DEFAULT_RETRY_POLICY;
  }

  authorizeOperator(actorId: string): void {
    this.authorized.add(actorId);
  }

  async subscribe(input: {
    readonly actorId: string;
    readonly ownerId: string;
    readonly destinationUrl: string;
    readonly secretRef: string;
    readonly eventFilter: readonly string[];
    readonly failureThreshold?: number;
  }): Promise<OutboundWebhookSubscription> {
    this.assertAuthorized(input.actorId);
    const row: OutboundWebhookSubscription = {
      subscriptionId: `whs_${randomUUID()}`,
      ownerId: input.ownerId,
      destinationUrl: input.destinationUrl,
      secretRef: input.secretRef,
      eventFilter: Object.freeze([...input.eventFilter]),
      active: true,
      consecutiveFailures: 0,
      failureThreshold: input.failureThreshold ?? DEFAULT_OUTBOUND_FAILURE_THRESHOLD,
      disabledAt: null,
      createdAt: this.clock.now(),
    };
    await this.store.putSubscription(row);
    return row;
  }

  async enqueueDelivery(input: {
    readonly actorId: string;
    readonly subscriptionId: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly payload: Readonly<Record<string, string>>;
    readonly trace?: TraceContext;
  }): Promise<OutboundWebhookDelivery | { readonly skipped: 'FILTER' | 'DISABLED' }> {
    this.assertAuthorized(input.actorId);
    const subscription = await this.store.getSubscription(input.subscriptionId);
    if (!subscription || !subscription.active) {
      return { skipped: 'DISABLED' };
    }
    if (subscription.eventFilter.length > 0 && !subscription.eventFilter.includes(input.eventType)) {
      return { skipped: 'FILTER' };
    }
    const secret = this.secrets(subscription.secretRef);
    if (!secret) {
      throw new Error('outbound webhook secret ref is unresolved');
    }
    const deliveryId = `whd_${randomUUID()}`;
    const timestamp = this.clock.now();
    const body = JSON.stringify({
      event_version: 'v1',
      event_id: input.eventId,
      delivery_id: deliveryId,
      event_type: input.eventType,
      occurred_at: timestamp,
      payload: input.payload,
    });
    const signed = signOutboundWebhook(secret, {
      deliveryId,
      eventId: input.eventId,
      timestamp,
      attempt: 1,
      body,
    });
    const delivery: OutboundWebhookDelivery = {
      deliveryId,
      subscriptionId: subscription.subscriptionId,
      eventId: input.eventId,
      eventType: input.eventType,
      attemptCount: 0,
      state: 'PENDING',
      lastAttemptAt: null,
      nextAttemptAt: timestamp,
      lastErrorClass: null,
      lastErrorSafe: null,
      bodyHash: signed.bodyHash,
      signature: signed.signature,
      correlationId: input.trace?.correlationId ?? input.eventId,
      requestId: input.trace?.requestId ?? null,
      createdAt: timestamp,
    };
    await this.store.putDelivery(delivery);
    return this.attempt(delivery, subscription, body, secret);
  }

  async retryDue(actorId: string): Promise<{ delivered: number; retried: number; deadLettered: number }> {
    this.assertAuthorized(actorId);
    let delivered = 0;
    let retried = 0;
    let deadLettered = 0;
    const now = this.clock.now();
    for (const delivery of await this.store.listDeliveries()) {
      if (delivery.state !== 'RETRYING' && delivery.state !== 'PENDING') {
        continue;
      }
      if (delivery.nextAttemptAt > now) {
        continue;
      }
      const subscription = await this.store.getSubscription(delivery.subscriptionId);
      const secret = subscription ? this.secrets(subscription.secretRef) : undefined;
      if (!subscription || !secret) {
        continue;
      }
      const body = JSON.stringify({
        event_version: 'v1',
        event_id: delivery.eventId,
        delivery_id: delivery.deliveryId,
        event_type: delivery.eventType,
        occurred_at: delivery.createdAt,
        payload: { replay: 'false' },
      });
      const result = await this.attempt(delivery, subscription, body, secret);
      if (result.state === 'DELIVERED') {
        delivered += 1;
      } else if (result.state === 'DEAD_LETTER' || result.state === 'DISABLED') {
        deadLettered += 1;
      } else {
        retried += 1;
      }
    }
    return { delivered, retried, deadLettered };
  }

  private async attempt(
    delivery: OutboundWebhookDelivery,
    subscription: OutboundWebhookSubscription,
    body: string,
    secret: string,
  ): Promise<OutboundWebhookDelivery> {
    const attempt = delivery.attemptCount + 1;
    const signed = signOutboundWebhook(secret, {
      deliveryId: delivery.deliveryId,
      eventId: delivery.eventId,
      timestamp: delivery.createdAt,
      attempt,
      body,
    });
    try {
      const result = await this.transport({
        url: subscription.destinationUrl,
        headers: {
          'X-SunRey-Webhook-Id': delivery.deliveryId,
          'X-SunRey-Event-Id': delivery.eventId,
          'X-SunRey-Timestamp': delivery.createdAt,
          'X-SunRey-Attempt': String(attempt),
          'X-SunRey-Signature': signed.signature,
          'X-SunRey-Webhook-Scheme': OUTBOUND_WEBHOOK_SCHEME,
        },
        body,
      });
      if (result.ok) {
        const next: OutboundWebhookDelivery = {
          ...delivery,
          attemptCount: attempt,
          state: 'DELIVERED',
          lastAttemptAt: this.clock.now(),
          lastErrorClass: null,
          lastErrorSafe: null,
          bodyHash: signed.bodyHash,
          signature: signed.signature,
        };
        await this.store.putDelivery(next);
        await this.store.putSubscription({ ...subscription, consecutiveFailures: 0 });
        return next;
      }
      throw new Error(`webhook status ${String(result.status ?? 'transport')}`);
    } catch (error) {
      const failure = classifyFailure(error);
      const exhausted = attempt >= this.policy.maxAttempts || !shouldRetry(failure);
      const consecutive = subscription.consecutiveFailures + 1;
      const disable = consecutive >= subscription.failureThreshold;
      const next: OutboundWebhookDelivery = {
        ...delivery,
        attemptCount: attempt,
        state: disable ? 'DISABLED' : exhausted ? 'DEAD_LETTER' : 'RETRYING',
        lastAttemptAt: this.clock.now(),
        nextAttemptAt: new Date(this.clock.nowMs() + nextAttemptDelayMs(attempt, this.policy)).toISOString(),
        lastErrorClass: failure.retryClass,
        lastErrorSafe: failure.message,
        bodyHash: signed.bodyHash,
        signature: signed.signature,
      };
      await this.store.putDelivery(next);
      await this.store.putSubscription({
        ...subscription,
        consecutiveFailures: consecutive,
        active: disable ? false : subscription.active,
        disabledAt: disable ? this.clock.now() : subscription.disabledAt,
      });
      return next;
    }
  }

  private assertAuthorized(actorId: string): void {
    if (!this.authorized.has(actorId)) {
      throw new Error('outbound webhook operations require an authorized internal actor');
    }
  }
}

export function signOutboundWebhook(
  secret: string,
  input: {
    readonly deliveryId: string;
    readonly eventId: string;
    readonly timestamp: string;
    readonly attempt: number;
    readonly body: string;
  },
): { readonly signature: string; readonly bodyHash: string } {
  const bodyHash = sha256Hex(input.body);
  const payload = `${OUTBOUND_WEBHOOK_SCHEME}.${input.deliveryId}.${input.eventId}.${input.timestamp}.${String(input.attempt)}.${bodyHash}`;
  const digest = createHmac('sha256', secret).update(payload).digest('hex');
  return { signature: `${OUTBOUND_WEBHOOK_SCHEME}=${digest}`, bodyHash };
}

export function verifyOutboundWebhookSignature(input: {
  readonly secret: string;
  readonly signature: string;
  readonly deliveryId: string;
  readonly eventId: string;
  readonly timestamp: string;
  readonly attempt: number;
  readonly body: string;
  readonly nowMs: number;
}): { readonly ok: true } | { readonly ok: false; readonly code: 'INVALID_SIGNATURE' | 'STALE_TIMESTAMP' } {
  const timestampMs = Date.parse(input.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(input.nowMs - timestampMs) > WEBHOOK_REPLAY_WINDOW_MS) {
    return { ok: false, code: 'STALE_TIMESTAMP' };
  }
  const expected = signOutboundWebhook(input.secret, input).signature;
  const left = Buffer.from(expected);
  const right = Buffer.from(input.signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, code: 'INVALID_SIGNATURE' };
  }
  return { ok: true };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
