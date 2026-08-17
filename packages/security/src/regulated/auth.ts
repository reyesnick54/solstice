import type { SecretReference } from '../secrets.ts';

/**
 * Chunk 66-aligned provider authentication.
 * Credentials stay in SecretReference form. Source never holds plaintext.
 */
export const PROVIDER_AUTH_METHODS = [
  'MTLS',
  'OAUTH_CLIENT_CREDENTIAL_REFERENCE',
  'SIGNED_WEBHOOK',
  'API_CREDENTIAL_REFERENCE',
] as const;
export type ProviderAuthMethod = (typeof PROVIDER_AUTH_METHODS)[number];

export type ProviderAuthenticationBinding = {
  readonly providerId: string;
  readonly method: ProviderAuthMethod;
  readonly credentialRef: SecretReference;
  readonly workloadIdentityRef: string | null;
  readonly mtlsClientCertRef: string | null;
  readonly plaintextCredentialInSource: false;
};

export function bindProviderAuthentication(input: {
  readonly providerId: string;
  readonly method: ProviderAuthMethod;
  readonly credentialRef: SecretReference;
  readonly workloadIdentityRef?: string;
  readonly mtlsClientCertRef?: string;
}): ProviderAuthenticationBinding {
  return Object.freeze({
    providerId: input.providerId,
    method: input.method,
    credentialRef: input.credentialRef,
    workloadIdentityRef: input.workloadIdentityRef ?? null,
    mtlsClientCertRef: input.mtlsClientCertRef ?? null,
    plaintextCredentialInSource: false,
  });
}

export function redactProviderLog(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('secret://')) {
      return 'secret://[REDACTED]';
    }
    if (/api[_-]?key|client_secret|password|bearer\s+/i.test(value)) {
      return '[REDACTED]';
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactProviderLog);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/secret|credential|password|token|apiKey|authorization/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactProviderLog(nested);
      }
    }
    return out;
  }
  return value;
}
