/**
 * Credential descriptor binding for oracle provider candidates.
 *
 * Chunk 149 owns regulated credential descriptors. This module stores
 * references only. Resolution belongs inside an adapter/transport
 * boundary — never during profile construction.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { bindProviderAuthentication, type ProviderAuthenticationBinding } from '../../../../../security/src/regulated/auth.ts';
import { secretRef, type SecretReference } from '../../../../../security/src/secrets.ts';
import type { AuthenticationMethod } from '../types.ts';
import {
  candidateRejection,
  type ExternalProviderCredentialBinding,
  type OauthTokenHandle,
  type ProviderCandidateRejection,
} from './types.ts';

const SECRET_VALUE = /bearer\s+|-----BEGIN|client_secret|api[_-]?key\s*[:=]/i;

export function chunk149CredentialPlanePresent(): boolean {
  const here = dirname(fileURLToPath(import.meta.url));
  return existsSync(join(here, '../../../../../security/src/regulated/credentials/index.ts'));
}

export function bindCredentialDescriptor(input: {
  readonly descriptorRef: string;
  readonly providerId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly secretPath?: string;
  readonly mtlsCertificateRef?: string;
  readonly oauthClientRef?: string;
  readonly generation?: number;
  readonly expiresAtUnix?: bigint | null;
}): Result<ExternalProviderCredentialBinding, ProviderCandidateRejection> {
  if (input.descriptorRef.length === 0) {
    return err(candidateRejection('PROFILE_INVALID', 'credentialDescriptorRef is required'));
  }
  if (SECRET_VALUE.test(input.descriptorRef) || (input.secretPath !== undefined && SECRET_VALUE.test(input.secretPath))) {
    return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', 'credential bindings cannot store secret values'));
  }
  if (input.authenticationMethod === 'FILE_FIXTURE_TEST_ONLY') {
    return err(candidateRejection('PROFILE_INVALID', 'FILE_FIXTURE_TEST_ONLY is not an external-provider auth class'));
  }
  return ok(
    Object.freeze({
      descriptorRef: input.descriptorRef,
      providerId: input.providerId,
      authenticationMethod: input.authenticationMethod,
      secretReferenceHref: input.secretPath ? secretRef('simulation', input.secretPath).href : null,
      mtlsCertificateRef: input.mtlsCertificateRef ?? null,
      oauthClientRef: input.oauthClientRef ?? null,
      generation: input.generation ?? 1,
      expiresAtUnix: input.expiresAtUnix ?? null,
      resolvedMaterial: null,
      plaintextPresent: false,
    }),
  );
}

export function toRegulatedAuthenticationBinding(
  binding: ExternalProviderCredentialBinding,
): Result<ProviderAuthenticationBinding, ProviderCandidateRejection> {
  if (binding.plaintextPresent !== false || binding.resolvedMaterial !== null) {
    return err(candidateRejection('SECRET_RESOLUTION_FORBIDDEN', 'resolved credential material cannot leave the transport'));
  }
  const href = binding.secretReferenceHref ?? `secret://simulation/oracle/${binding.providerId}`;
  const reference: SecretReference = {
    scheme: 'secret',
    provider: 'simulation',
    path: href.replace(/^secret:\/\/simulation\//, ''),
    href,
  };
  const method =
    binding.authenticationMethod === 'MTLS'
      ? 'MTLS'
      : binding.authenticationMethod === 'OAUTH_CLIENT'
        ? 'OAUTH_CLIENT_CREDENTIAL_REFERENCE'
        : binding.authenticationMethod === 'SIGNED_REQUEST'
          ? 'SIGNED_WEBHOOK'
          : 'API_CREDENTIAL_REFERENCE';
  return ok(
    bindProviderAuthentication({
      providerId: binding.providerId,
      method,
      credentialRef: reference,
      mtlsClientCertRef: binding.mtlsCertificateRef ?? undefined,
    }),
  );
}

export function issueOauthHandle(input: {
  readonly providerId: string;
  readonly nowUnix: bigint;
  readonly ttlSeconds?: bigint;
}): OauthTokenHandle {
  return Object.freeze({
    handleId: `oauth-handle:${input.providerId}`,
    providerId: input.providerId,
    expiresAtUnix: input.nowUnix + (input.ttlSeconds ?? 300n),
    tokenMaterial: null,
    persisted: false,
  });
}

export function assertOauthHandleNotPersisted(value: unknown): Result<true, ProviderCandidateRejection> {
  const encoded = JSON.stringify(value, (_key, nested) => (typeof nested === 'bigint' ? nested.toString() : nested));
  if (/access_token|refresh_token|Bearer [A-Za-z0-9\-._~+/]+=*/.test(encoded)) {
    return err(candidateRejection('OAUTH_TOKEN_LEAK', 'OAuth token material must not persist'));
  }
  return ok(true);
}

export function credentialIsExpired(binding: ExternalProviderCredentialBinding, nowUnix: bigint): boolean {
  return binding.expiresAtUnix !== null && nowUnix >= binding.expiresAtUnix;
}

export function assertMtlsReferenceOnly(binding: ExternalProviderCredentialBinding): Result<true, ProviderCandidateRejection> {
  if (binding.authenticationMethod !== 'MTLS') {
    return err(candidateRejection('PROFILE_INVALID', 'expected MTLS binding'));
  }
  if (binding.mtlsCertificateRef === null || binding.resolvedMaterial !== null) {
    return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', 'mTLS bindings must be certificate references only'));
  }
  return ok(true);
}

export function assertApiKeyReferenceOnly(binding: ExternalProviderCredentialBinding): Result<true, ProviderCandidateRejection> {
  if (binding.authenticationMethod !== 'API_KEY_REFERENCE') {
    return err(candidateRejection('PROFILE_INVALID', 'expected API_KEY_REFERENCE binding'));
  }
  if (binding.secretReferenceHref === null || !binding.secretReferenceHref.startsWith('secret://')) {
    return err(candidateRejection('AUTHORIZATION_IN_BLUEPRINT', 'API key bindings must be SecretReference hrefs'));
  }
  if (binding.resolvedMaterial !== null) {
    return err(candidateRejection('SECRET_RESOLUTION_FORBIDDEN', 'API key material cannot be resolved on the profile'));
  }
  return ok(true);
}
