/**
 * Expedia credential references — secrets resolved via ProviderCredentialPort.
 */

import type { ProviderCredentialPort, ProviderCredentialRef } from '../../security.ts';

export const EXPEDIA_CREDENTIAL_REFS = Object.freeze({
  API_KEY: Object.freeze({
    secretRef: 'regulated/expedia/rapid/api-key',
    providerId: 'expedia' as const,
    kind: 'API_KEY' as const,
  }),
  SHARED_SECRET: Object.freeze({
    secretRef: 'regulated/expedia/rapid/shared-secret',
    providerId: 'expedia' as const,
    kind: 'API_KEY' as const,
  }),
  WEBHOOK_SIGNING_KEY: Object.freeze({
    secretRef: 'regulated/expedia/rapid/webhook-signing-key',
    providerId: 'expedia' as const,
    kind: 'WEBHOOK_SIGNING_KEY' as const,
  }),
});

export type ExpediaCredentialBundle = {
  readonly apiKey: string | null;
  readonly sharedSecret: string | null;
  readonly webhookSigningKey: string | null;
  readonly state: 'CREDENTIALS_REQUIRED' | 'SANDBOX_READY';
};

export async function resolveExpediaCredentials(
  port: ProviderCredentialPort,
): Promise<ExpediaCredentialBundle> {
  const apiKey = await port.getCredential(EXPEDIA_CREDENTIAL_REFS.API_KEY);
  const sharedSecret = await port.getCredential(EXPEDIA_CREDENTIAL_REFS.SHARED_SECRET);
  const webhookSigningKey = await port.getCredential(EXPEDIA_CREDENTIAL_REFS.WEBHOOK_SIGNING_KEY);
  if (!apiKey || !sharedSecret) {
    return Object.freeze({
      apiKey: null,
      sharedSecret: null,
      webhookSigningKey,
      state: 'CREDENTIALS_REQUIRED',
    });
  }
  return Object.freeze({
    apiKey,
    sharedSecret,
    webhookSigningKey,
    state: 'SANDBOX_READY',
  });
}

export async function rotateExpediaCredentials(port: ProviderCredentialPort): Promise<void> {
  const refs: readonly ProviderCredentialRef[] = [
    EXPEDIA_CREDENTIAL_REFS.API_KEY,
    EXPEDIA_CREDENTIAL_REFS.SHARED_SECRET,
    EXPEDIA_CREDENTIAL_REFS.WEBHOOK_SIGNING_KEY,
  ];
  for (const ref of refs) {
    await port.rotateCredential(ref);
  }
}
