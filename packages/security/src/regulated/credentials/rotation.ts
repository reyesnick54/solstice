import type {
  CredentialPlaneResult,
  CredentialRotationState,
  ProviderCredentialDescriptor,
} from './types.ts';
import { credentialErr, credentialOk } from './redaction.ts';

export function startRotation(input: {
  readonly current: ProviderCredentialDescriptor;
  readonly nextVersion: number;
  readonly now: string;
  readonly overlapUntil: string;
  readonly allowOverlap: boolean;
}): CredentialPlaneResult<{
  readonly current: ProviderCredentialDescriptor;
  readonly rotation: CredentialRotationState;
}> {
  if (input.current.status !== 'ACTIVE') {
    return credentialErr('CREDENTIAL_SCOPE_MISMATCH', 'only ACTIVE credentials can enter ROTATING', {
      credentialId: input.current.credentialId,
    });
  }
  const overlapUntil = input.allowOverlap ? input.overlapUntil : input.now;
  return credentialOk(
    Object.freeze({
      current: Object.freeze({
        ...input.current,
        status: 'ROTATING' as const,
        rotationGeneration: input.current.rotationGeneration + 1,
        version: input.nextVersion,
      }),
      rotation: Object.freeze({
        credentialId: input.current.credentialId,
        currentVersion: input.nextVersion,
        previousVersion: input.current.version,
        rotationStartedAt: input.now,
        overlapUntil,
        status: 'ROTATING' as const,
      }),
    }),
  );
}

export function completeRotation(
  rotating: ProviderCredentialDescriptor,
  rotation: CredentialRotationState,
): CredentialPlaneResult<{
  readonly current: ProviderCredentialDescriptor;
  readonly previous: ProviderCredentialDescriptor;
  readonly rotation: CredentialRotationState;
}> {
  return credentialOk(
    Object.freeze({
      current: Object.freeze({ ...rotating, status: 'ACTIVE' as const }),
      previous: Object.freeze({
        ...rotating,
        version: rotation.previousVersion ?? rotating.version - 1,
        status: 'RETIRED' as const,
      }),
      rotation: Object.freeze({
        ...rotation,
        previousVersion: rotation.previousVersion,
        status: 'RETIRED' as const,
        overlapUntil: null,
      }),
    }),
  );
}

export function revokeCredential(
  descriptor: ProviderCredentialDescriptor,
): ProviderCredentialDescriptor {
  return Object.freeze({ ...descriptor, status: 'REVOKED' as const });
}

export function webhookVersionsForVerification(input: {
  readonly currentVersion: number;
  readonly previousVersion: number | null;
  readonly overlapUntil: string | null;
  readonly now: string;
}): readonly number[] {
  if (input.previousVersion !== null && input.overlapUntil && Date.parse(input.now) < Date.parse(input.overlapUntil)) {
    return Object.freeze([input.currentVersion, input.previousVersion]);
  }
  return Object.freeze([input.currentVersion]);
}

export function acceptWebhookVersion(input: {
  readonly requestedVersion: number;
  readonly currentVersion: number;
  readonly previousVersion: number | null;
  readonly overlapUntil: string | null;
  readonly now: string;
}): CredentialPlaneResult<number> {
  const approved = webhookVersionsForVerification(input);
  if (!approved.includes(input.requestedVersion)) {
    return credentialErr('CREDENTIAL_RETIRED', 'webhook signing version is outside the approved overlap');
  }
  return credentialOk(input.requestedVersion);
}
