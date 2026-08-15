import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { isExpired } from '../../config/src/clock.ts';
import type { PaymentId } from './ids.ts';
import type { ProviderAuthConfig, ProviderAuthenticator } from './rail-auth.ts';
import {
  asProviderEventId,
  asProviderId,
  asRailSubmissionId,
  emptyRailReferences,
  type ProviderEventId,
  type ProviderId,
  type RailSubmissionId,
} from './rail-ids.ts';
import type { RailStatusUpdate } from './rail-port.ts';
import { normalizeProviderStatus, type CanonicalRailStatus } from './rail-types.ts';

export const CALLBACK_SCHEMA_VERSION = 1;
export const CALLBACK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

export type IncomingProviderCallback = {
  readonly provider: string;
  readonly timestamp: UtcInstant;
  readonly signature: string;
  readonly schemaVersion: number;
  readonly providerEventId: string;
  readonly paymentId: string;
  readonly railSubmissionId: string;
  readonly providerStatus: string;
  readonly payloadHash: string;
};

export type CallbackIngestResult =
  | { readonly outcome: 'ACCEPTED'; readonly update: RailStatusUpdate; readonly duplicate: boolean }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string }
  | { readonly outcome: 'DEAD_LETTER'; readonly code: string; readonly message: string };

export type CallbackRecord = {
  readonly providerEventId: ProviderEventId;
  readonly provider: ProviderId;
  readonly payloadHash: string;
  readonly receivedAt: UtcInstant;
  readonly status: 'PROCESSED' | 'DEAD_LETTER';
};

const DEAD_LETTER_CODES = new Set([
  'INVALID_SIGNATURE',
  'STALE_CALLBACK',
  'SCHEMA_UNSUPPORTED',
  'UNKNOWN_PROVIDER',
]);

export class ProviderCallbackIngestor {
  private readonly seen = new Map<string, CallbackRecord>();
  private readonly deadLetters: CallbackRecord[] = [];
  private readonly authenticator: ProviderAuthenticator;
  private readonly configs: ReadonlyMap<string, ProviderAuthConfig>;
  private readonly now: () => UtcInstant;

  constructor(
    authenticator: ProviderAuthenticator,
    configs: ReadonlyMap<string, ProviderAuthConfig>,
    now: () => UtcInstant,
  ) {
    this.authenticator = authenticator;
    this.configs = configs;
    this.now = now;
  }

  ingest(callback: IncomingProviderCallback): CallbackIngestResult {
    const config = this.configs.get(callback.provider);
    if (!config) {
      return this.deadLetter(callback, 'UNKNOWN_PROVIDER', 'provider is not registered');
    }
    if (callback.schemaVersion !== CALLBACK_SCHEMA_VERSION) {
      return this.deadLetter(callback, 'SCHEMA_UNSUPPORTED', `schema ${callback.schemaVersion} is not supported`);
    }
    const replayDeadline = new Date(Date.parse(callback.timestamp) + CALLBACK_REPLAY_WINDOW_MS).toISOString() as UtcInstant;
    if (isExpired(replayDeadline, this.now())) {
      return this.deadLetter(callback, 'STALE_CALLBACK', 'callback timestamp is outside the replay window');
    }
    const signedMaterial = canonicalCallbackMaterial(callback);
    if (!this.authenticator.verifyWebhook(config, signedMaterial, callback.signature)) {
      return this.deadLetter(callback, 'INVALID_SIGNATURE', 'webhook signature verification failed');
    }
    const existing = this.seen.get(callback.providerEventId);
    const update = toStatusUpdate(callback);
    if (existing) {
      return { outcome: 'ACCEPTED', update, duplicate: true };
    }
    this.seen.set(
      callback.providerEventId,
      Object.freeze({
        providerEventId: asProviderEventId(callback.providerEventId),
        provider: asProviderId(callback.provider),
        payloadHash: callback.payloadHash,
        receivedAt: this.now(),
        status: 'PROCESSED',
      }),
    );
    return { outcome: 'ACCEPTED', update, duplicate: false };
  }

  listDeadLetters(): readonly CallbackRecord[] {
    return this.deadLetters.slice();
  }

  wasProcessed(providerEventId: string): boolean {
    return this.seen.has(providerEventId);
  }

  private deadLetter(callback: IncomingProviderCallback, code: string, message: string): CallbackIngestResult {
    const record = Object.freeze({
      providerEventId: asProviderEventId(callback.providerEventId || `dlq_${callback.provider}_${callback.timestamp}`),
      provider: asProviderId(callback.provider || 'UNKNOWN'),
      payloadHash: callback.payloadHash,
      receivedAt: this.now(),
      status: 'DEAD_LETTER' as const,
    });
    this.deadLetters.push(record);
    if (DEAD_LETTER_CODES.has(code)) {
      return { outcome: 'DEAD_LETTER', code, message };
    }
    return { outcome: 'REJECTED', code, message };
  }
}

export function canonicalCallbackMaterial(callback: IncomingProviderCallback): string {
  return [
    callback.provider,
    callback.timestamp,
    String(callback.schemaVersion),
    callback.providerEventId,
    callback.paymentId,
    callback.railSubmissionId,
    callback.providerStatus,
    callback.payloadHash,
  ].join('|');
}

export function hashCallbackBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function toStatusUpdate(callback: IncomingProviderCallback): RailStatusUpdate {
  const status: CanonicalRailStatus = normalizeProviderStatus(callback.providerStatus);
  return Object.freeze({
    paymentId: callback.paymentId as PaymentId,
    railSubmissionId: asRailSubmissionId(callback.railSubmissionId),
    provider: asProviderId(callback.provider),
    status,
    references: emptyRailReferences(),
    providerEventId: asProviderEventId(callback.providerEventId),
    occurredAt: callback.timestamp,
    payloadHash: callback.payloadHash,
  });
}

export function signSimulationCallback(
  authenticator: ProviderAuthenticator,
  config: ProviderAuthConfig,
  callback: Omit<IncomingProviderCallback, 'signature'>,
): IncomingProviderCallback {
  const signature = authenticator.signWebhook(config, canonicalCallbackMaterial({ ...callback, signature: '' }));
  return Object.freeze({ ...callback, signature });
}
