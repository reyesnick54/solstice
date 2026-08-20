import type {
  CredentialPlaneResult,
  ProviderCredentialDescriptor,
} from './types.ts';
import { credentialErr, credentialOk } from './redaction.ts';

export function evaluateCredentialValidity(
  descriptor: ProviderCredentialDescriptor,
  now: string,
): CredentialPlaneResult<ProviderCredentialDescriptor> {
  if (descriptor.status === 'REVOKED') {
    return credentialErr('CREDENTIAL_REVOKED', 'credential is revoked', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  if (descriptor.status === 'RETIRED') {
    return credentialErr('CREDENTIAL_RETIRED', 'credential is retired', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  if (descriptor.status === 'EXPIRED') {
    return credentialErr('CREDENTIAL_EXPIRED', 'credential is expired', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) {
    return credentialErr('CREDENTIAL_EXPIRED', 'credential clock is invalid', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  if (nowMs < Date.parse(descriptor.notBefore)) {
    return credentialErr('CREDENTIAL_NOT_YET_VALID', 'credential is not yet valid', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  if (nowMs >= Date.parse(descriptor.expiresAt)) {
    return credentialErr('CREDENTIAL_EXPIRED', 'credential validity window has ended', {
      providerId: descriptor.providerId,
      credentialId: descriptor.credentialId,
    });
  }
  return credentialOk(descriptor);
}
