import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  CALLBACK_REPLAY_WINDOW_MS,
  CALLBACK_SCHEMA_VERSION,
  ProviderCallbackIngestor,
  canonicalCallbackMaterial,
  hashCallbackBody,
  signSimulationCallback,
  type IncomingProviderCallback,
} from '../rail-webhook.ts';
import type { RailStatusUpdate } from '../rail-port.ts';
import type { CandidateProviderAuthConfig, CandidateProviderAuthenticator } from './auth.ts';

export type CandidateWebhookEnvelope = IncomingProviderCallback & {
  readonly nonce: string;
  readonly providerIdentity: string;
  readonly payloadDigest: string;
};

export type CandidateWebhookResult =
  | { readonly outcome: 'ACCEPTED'; readonly update: RailStatusUpdate; readonly duplicate: boolean; readonly postsJournal: false }
  | { readonly outcome: 'REJECTED'; readonly code: string; readonly message: string; readonly postsJournal: false }
  | { readonly outcome: 'DEAD_LETTER'; readonly code: string; readonly message: string; readonly postsJournal: false };

/**
 * Webhook is rail-state input only. SETTLED does not post a journal.
 */
export class CandidateWebhookIngestor {
  private readonly inner: ProviderCallbackIngestor;
  private readonly nonces = new Set<string>();
  private readonly authenticator: CandidateProviderAuthenticator;
  private readonly configs: ReadonlyMap<string, CandidateProviderAuthConfig>;

  constructor(
    authenticator: CandidateProviderAuthenticator,
    configs: ReadonlyMap<string, CandidateProviderAuthConfig>,
    now: () => UtcInstant,
  ) {
    this.authenticator = authenticator;
    this.configs = configs;
    this.inner = new ProviderCallbackIngestor(authenticator, configs, now);
  }

  ingest(envelope: CandidateWebhookEnvelope): CandidateWebhookResult {
    const config = this.configs.get(envelope.provider);
    if (!config) {
      return { outcome: 'DEAD_LETTER', code: 'UNKNOWN_PROVIDER', message: 'provider identity is not registered', postsJournal: false };
    }
    if (envelope.providerIdentity !== envelope.provider) {
      return { outcome: 'DEAD_LETTER', code: 'PROVIDER_IDENTITY', message: 'provider identity mismatch', postsJournal: false };
    }
    if (envelope.payloadDigest !== envelope.payloadHash) {
      return { outcome: 'DEAD_LETTER', code: 'PAYLOAD_DIGEST', message: 'payload digest mismatch', postsJournal: false };
    }
    if (this.nonces.has(envelope.nonce)) {
      return { outcome: 'REJECTED', code: 'REPLAY', message: 'webhook nonce already seen', postsJournal: false };
    }
    const result = this.inner.ingest(envelope);
    if (result.outcome === 'ACCEPTED' && !result.duplicate) {
      this.nonces.add(envelope.nonce);
    }
    return { ...result, postsJournal: false };
  }

  sign(config: CandidateProviderAuthConfig, envelope: Omit<CandidateWebhookEnvelope, 'signature'>): CandidateWebhookEnvelope {
    const signed = signSimulationCallback(this.authenticator, config, envelope);
    return Object.freeze({ ...envelope, signature: signed.signature });
  }
}

export function digestWebhookPayload(body: string): string {
  return hashCallbackBody(body);
}

export function candidateWebhookMaterial(envelope: CandidateWebhookEnvelope): string {
  return [
    canonicalCallbackMaterial(envelope),
    envelope.nonce,
    envelope.providerIdentity,
    envelope.payloadDigest,
  ].join('|');
}

export function webhookReplayWindowMs(): number {
  return CALLBACK_REPLAY_WINDOW_MS;
}

export function webhookSchemaVersion(): number {
  return CALLBACK_SCHEMA_VERSION;
}

export function payloadDigestOf(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
