import { randomUUID } from 'node:crypto';

import { signWebhookDelivery, WEBHOOK_SIGNING_SCHEME } from './crypto.ts';
import { inspectWebhookDestination, WEBHOOK_MAX_RESPONSE_BYTES, type SsrfRejection } from './ssrf.ts';
import {
  DEFAULT_WEBHOOK_RETRY_POLICY,
  type ApplicationEnvironment,
  type DeveloperPermission,
  type WebhookDelivery,
  type WebhookDeliveryState,
  type WebhookEndpoint,
  type WebhookEventType,
  type WebhookRetryPolicy,
  SCOPE_REQUIRED_EVENTS,
} from './types.ts';

export type WebhookEvent = {
  readonly eventId: string;
  readonly eventType: WebhookEventType;
  readonly occurredAt: string;
  readonly appId: string;
  readonly payload: Readonly<Record<string, string>>;
};

export type DeliveryAttemptResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: SsrfRejection | 'TRANSPORT' | 'STATUS' };

export type WebhookTransport = (input: {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly maxResponseBytes: number;
  readonly followRedirects: false;
}) => Promise<DeliveryAttemptResult>;

export const inProcessMockTransport: WebhookTransport = async () => ({ ok: true });

export function nextDeliveryState(
  current: WebhookDeliveryState,
  attempt: number,
  policy: WebhookRetryPolicy,
  succeeded: boolean,
): WebhookDeliveryState {
  if (succeeded) {
    return 'DELIVERED';
  }
  if (attempt >= policy.maxAttempts) {
    return 'PERMANENTLY_FAILED';
  }
  return 'RETRYING';
}

export function backoffForAttempt(policy: WebhookRetryPolicy, attempt: number): number {
  const index = Math.max(0, Math.min(attempt - 1, policy.backoffMs.length - 1));
  return policy.backoffMs[index] ?? 64_000;
}

export class WebhookDispatcher {
  readonly policy: WebhookRetryPolicy;
  private readonly transport: WebhookTransport;
  private readonly secrets = new Map<string, string>();
  private readonly deliveries = new Map<string, WebhookDelivery>();
  private readonly byEvent = new Map<string, string[]>();

  constructor(input: { readonly policy?: WebhookRetryPolicy; readonly transport?: WebhookTransport } = {}) {
    this.policy = input.policy ?? DEFAULT_WEBHOOK_RETRY_POLICY;
    this.transport = input.transport ?? inProcessMockTransport;
    if (this.policy.infinite !== false || this.policy.maxAttempts < 1) {
      throw new Error('webhook retry policy must be bounded');
    }
  }

  rememberSecret(endpointId: string, secret: string): void {
    this.secrets.set(endpointId, secret);
  }

  forgetSecret(endpointId: string): void {
    this.secrets.delete(endpointId);
  }

  get(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  listForEvent(eventId: string): readonly WebhookDelivery[] {
    return (this.byEvent.get(eventId) ?? []).map((id) => this.deliveries.get(id)).filter((row): row is WebhookDelivery => row !== undefined);
  }

  eventIsAuthorized(eventType: WebhookEventType, scopes: readonly DeveloperPermission[]): boolean {
    return scopes.includes(SCOPE_REQUIRED_EVENTS[eventType]);
  }

  async dispatch(input: {
    readonly endpoint: WebhookEndpoint;
    readonly event: WebhookEvent;
    readonly environment: ApplicationEnvironment;
    readonly scopes: readonly DeveloperPermission[];
    readonly allowLocalMock?: boolean;
  }): Promise<WebhookDelivery | { readonly rejected: SsrfRejection | 'UNAUTHORIZED_EVENT' }> {
    if (!this.eventIsAuthorized(input.event.eventType, input.scopes)) {
      return { rejected: 'UNAUTHORIZED_EVENT' };
    }
    if (!input.endpoint.events.includes(input.event.eventType) || !input.endpoint.active) {
      return { rejected: 'UNAUTHORIZED_EVENT' };
    }
    const destination = inspectWebhookDestination(input.endpoint.url, {
      environment: input.environment,
      ...(input.allowLocalMock !== undefined ? { allowLocalMock: input.allowLocalMock } : {}),
    });
    if (!destination.ok) {
      return { rejected: destination.reason };
    }
    const secret = this.secrets.get(input.endpoint.endpointId);
    if (!secret) {
      return { rejected: 'UNAUTHORIZED_EVENT' };
    }
    const deliveryId = `whd_${randomUUID()}`;
    const timestamp = input.event.occurredAt;
    const body = JSON.stringify({
      event_version: 'v1',
      event_id: input.event.eventId,
      delivery_id: deliveryId,
      event_type: input.event.eventType,
      occurred_at: timestamp,
      app_id: input.event.appId,
      payload: input.event.payload,
    });
    const signed = signWebhookDelivery(secret, {
      deliveryId,
      eventId: input.event.eventId,
      timestamp,
      attempt: 1,
      body,
    });
    const delivery: WebhookDelivery = {
      deliveryId,
      eventId: input.event.eventId,
      endpointId: input.endpoint.endpointId,
      appId: input.event.appId,
      eventType: input.event.eventType,
      timestamp,
      attempt: 1,
      state: 'PENDING',
      signature: signed.signature,
      bodyHash: signed.bodyHash,
    };
    this.store(delivery);
    return this.attempt(delivery, input.endpoint, body, secret);
  }

  async retry(deliveryId: string, endpoint: WebhookEndpoint): Promise<WebhookDelivery | undefined> {
    const existing = this.deliveries.get(deliveryId);
    const secret = this.secrets.get(endpoint.endpointId);
    if (!existing || !secret) {
      return existing;
    }
    if (existing.state === 'DELIVERED' || existing.state === 'PERMANENTLY_FAILED') {
      return existing;
    }
    const nextAttempt = existing.attempt + 1;
    const body = JSON.stringify({
      event_version: 'v1',
      event_id: existing.eventId,
      delivery_id: existing.deliveryId,
      event_type: existing.eventType,
      occurred_at: existing.timestamp,
      app_id: existing.appId,
      payload: { replay: 'false' },
    });
    const signed = signWebhookDelivery(secret, {
      deliveryId: existing.deliveryId,
      eventId: existing.eventId,
      timestamp: existing.timestamp,
      attempt: nextAttempt,
      body,
    });
    const next: WebhookDelivery = {
      ...existing,
      attempt: nextAttempt,
      signature: signed.signature,
      bodyHash: signed.bodyHash,
      state: 'RETRYING',
    };
    this.store(next);
    return this.attempt(next, endpoint, body, secret);
  }

  verificationHeaders(delivery: WebhookDelivery): Readonly<Record<string, string>> {
    return Object.freeze({
      'X-SunRey-Webhook-Id': delivery.deliveryId,
      'X-SunRey-Event-Id': delivery.eventId,
      'X-SunRey-Timestamp': delivery.timestamp,
      'X-SunRey-Attempt': String(delivery.attempt),
      'X-SunRey-Signature': delivery.signature,
      'X-SunRey-Webhook-Scheme': WEBHOOK_SIGNING_SCHEME,
    });
  }

  private async attempt(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    body: string,
    _secret: string,
  ): Promise<WebhookDelivery> {
    const result = await this.transport({
      url: endpoint.url,
      headers: this.verificationHeaders(delivery),
      body,
      maxResponseBytes: WEBHOOK_MAX_RESPONSE_BYTES,
      followRedirects: false,
    });
    const state = nextDeliveryState(delivery.state, delivery.attempt, this.policy, result.ok);
    const next = { ...delivery, state };
    this.store(next);
    return next;
  }

  private store(delivery: WebhookDelivery): void {
    this.deliveries.set(delivery.deliveryId, delivery);
    const list = this.byEvent.get(delivery.eventId) ?? [];
    if (!list.includes(delivery.deliveryId)) {
      list.push(delivery.deliveryId);
      this.byEvent.set(delivery.eventId, list);
    }
  }
}

export { WEBHOOK_SIGNING_SCHEME };
