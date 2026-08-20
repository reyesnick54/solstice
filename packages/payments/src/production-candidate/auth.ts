import type { SecretProvider, SecretReference } from '../../../security/src/secrets.ts';
import {
  SimulationProviderAuthenticator,
  assertNoPlaintextCredential,
  type ProviderAuthConfig,
  type ProviderAuthMechanism,
  type ProviderAuthenticator,
} from '../rail-auth.ts';
import type { ProviderId } from '../rail-ids.ts';
import type { CredentialDescriptorRef } from './types.ts';

export type CandidateProviderAuthConfig = ProviderAuthConfig & {
  readonly credentialDescriptorRef: CredentialDescriptorRef | null;
};

export function candidateAuthConfig(input: {
  readonly provider: ProviderId;
  readonly mechanism: ProviderAuthMechanism;
  readonly credentialRef: SecretReference | null;
  readonly webhookSignatureRef: SecretReference | null;
  readonly credentialDescriptorRef: CredentialDescriptorRef | null;
}): CandidateProviderAuthConfig {
  const config: CandidateProviderAuthConfig = Object.freeze({
    provider: input.provider,
    mechanism: input.mechanism,
    credentialRef: input.credentialRef,
    webhookSignatureRef: input.webhookSignatureRef,
    credentialDescriptorId: input.credentialDescriptorRef?.descriptorId ?? null,
    credentialDescriptorRef: input.credentialDescriptorRef,
  });
  assertNoPlaintextCredential(config);
  if (input.mechanism !== 'NONE' && !input.credentialRef && !input.credentialDescriptorRef) {
    throw new TypeError('candidate auth requires a SecretReference or Chunk 149 credential descriptor');
  }
  return config;
}

export function rotateCandidateCredential(
  config: CandidateProviderAuthConfig,
  next: { readonly credentialRef: SecretReference; readonly credentialDescriptorRef: CredentialDescriptorRef },
): CandidateProviderAuthConfig {
  if (next.credentialRef.href === config.credentialRef?.href) {
    throw new TypeError('credential rotation must use a distinct SecretReference');
  }
  return candidateAuthConfig({
    ...config,
    credentialRef: next.credentialRef,
    credentialDescriptorRef: next.credentialDescriptorRef,
  });
}

export class CandidateProviderAuthenticator implements ProviderAuthenticator {
  private readonly inner: SimulationProviderAuthenticator;

  constructor(secrets: SecretProvider) {
    this.inner = new SimulationProviderAuthenticator(secrets);
  }

  resolveCredential(config: ProviderAuthConfig): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    assertNoPlaintextCredential(config);
    const candidate = config as CandidateProviderAuthConfig;
    if (candidate.credentialDescriptorRef && candidate.credentialDescriptorRef.plaintextCredential !== false) {
      return { ok: false, reason: 'plaintext_credential_forbidden' };
    }
    if (candidate.credentialDescriptorRef && !config.credentialRef) {
      return this.inner.resolveCredential({
        ...config,
        credentialRef: candidate.credentialDescriptorRef.secretRef,
      });
    }
    return this.inner.resolveCredential(config);
  }

  signWebhook(config: ProviderAuthConfig, payload: string): string {
    return this.inner.signWebhook(config, payload);
  }

  verifyWebhook(config: ProviderAuthConfig, payload: string, signatureHex: string): boolean {
    return this.inner.verifyWebhook(config, payload, signatureHex);
  }
}
