import type { SecretProvider, SecretReference } from '../../security/src/secrets.ts';
import { secretRef } from '../../security/src/secrets.ts';
import { hmacSha256Hex, verifyHmacSha256Hex } from '../../security/src/hmac.ts';
import type { ProviderId } from './rail-ids.ts';

export const PROVIDER_AUTH_MECHANISMS = [
  'NONE',
  'API_KEY',
  'OAUTH_CLIENT_CREDENTIALS',
  'MTLS',
  'SIGNED_MESSAGE',
  'WEBHOOK_SIGNATURE',
] as const;
export type ProviderAuthMechanism = (typeof PROVIDER_AUTH_MECHANISMS)[number];

/**
 * Adapter configuration holds SecretReference values only.
 * Plaintext credentials are forbidden.
 */
export type ProviderAuthConfig = {
  readonly provider: ProviderId;
  readonly mechanism: ProviderAuthMechanism;
  readonly credentialRef: SecretReference | null;
  readonly webhookSignatureRef: SecretReference | null;
};

export type ProviderAuthenticator = {
  resolveCredential(config: ProviderAuthConfig): { readonly ok: true } | { readonly ok: false; readonly reason: string };
  signWebhook(config: ProviderAuthConfig, payload: string): string;
  verifyWebhook(config: ProviderAuthConfig, payload: string, signatureHex: string): boolean;
};

export function simulationAuthConfig(provider: ProviderId): ProviderAuthConfig {
  return Object.freeze({
    provider,
    mechanism: 'NONE',
    credentialRef: null,
    webhookSignatureRef: secretRef('simulation', `rail-webhook/${provider}`),
  });
}

export class SimulationProviderAuthenticator implements ProviderAuthenticator {
  private readonly secrets: SecretProvider;

  constructor(secrets: SecretProvider) {
    this.secrets = secrets;
  }

  resolveCredential(config: ProviderAuthConfig): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    if (config.mechanism === 'NONE') {
      return { ok: true };
    }
    if (!config.credentialRef) {
      return { ok: false, reason: 'missing_secret_reference' };
    }
    const resolved = this.secrets.resolve(config.credentialRef);
    if (!resolved.ok) {
      return { ok: false, reason: 'secret_unresolved' };
    }
    return { ok: true };
  }

  signWebhook(config: ProviderAuthConfig, payload: string): string {
    const key = this.webhookKey(config);
    return hmacSha256Hex(key, payload);
  }

  verifyWebhook(config: ProviderAuthConfig, payload: string, signatureHex: string): boolean {
    const key = this.webhookKey(config);
    return verifyHmacSha256Hex(key, payload, signatureHex);
  }

  private webhookKey(config: ProviderAuthConfig): string {
    if (!config.webhookSignatureRef) {
      return `simulation-webhook-${config.provider}`;
    }
    const resolved = this.secrets.resolve(config.webhookSignatureRef);
    if (!resolved.ok) {
      return `simulation-webhook-${config.provider}`;
    }
    return resolved.value.revealUtf8();
  }
}

export function assertNoPlaintextCredential(config: ProviderAuthConfig): void {
  const record = config as unknown as Record<string, unknown>;
  for (const key of ['apiKey', 'clientSecret', 'password', 'privateKey', 'token']) {
    if (typeof record[key] === 'string' && (record[key] as string).length > 0) {
      throw new Error('plaintext provider credential is forbidden; use SecretReference');
    }
  }
}
