import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type SunReyIdentityId = Brand<string, 'SunReyIdentityId'>;
/** @deprecated Compatibility alias. Same implementation as SunReyIdentityId. */
export type SolsticeIdentityId = SunReyIdentityId;
export type ActorId = Brand<string, 'ActorId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type DeviceId = Brand<string, 'DeviceId'>;
export type KycRecordId = Brand<string, 'KycRecordId'>;
export type CredentialId = Brand<string, 'CredentialId'>;
export type ChallengeId = Brand<string, 'ChallengeId'>;
export type RecoveryRequestId = Brand<string, 'RecoveryRequestId'>;
export type CapabilityGrantId = Brand<string, 'CapabilityGrantId'>;
export type BusinessIdentityId = Brand<string, 'BusinessIdentityId'>;

function nonEmpty<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return brandAs<string, Name>(value);
}

export function asSunReyIdentityId(value: string): SunReyIdentityId {
  return nonEmpty(value, 'SunReyIdentityId');
}

/** @deprecated Compatibility alias. Same implementation as asSunReyIdentityId. */
export const asSolsticeIdentityId = asSunReyIdentityId;

export function asActorId(value: string): ActorId {
  return nonEmpty(value, 'ActorId');
}

export function asSessionId(value: string): SessionId {
  return nonEmpty(value, 'SessionId');
}

export function asDeviceId(value: string): DeviceId {
  return nonEmpty(value, 'DeviceId');
}

export function asKycRecordId(value: string): KycRecordId {
  return nonEmpty(value, 'KycRecordId');
}

export function asCredentialId(value: string): CredentialId {
  return nonEmpty(value, 'CredentialId');
}

export function asChallengeId(value: string): ChallengeId {
  return nonEmpty(value, 'ChallengeId');
}

export function asRecoveryRequestId(value: string): RecoveryRequestId {
  return nonEmpty(value, 'RecoveryRequestId');
}

export function asCapabilityGrantId(value: string): CapabilityGrantId {
  return nonEmpty(value, 'CapabilityGrantId');
}

export function asBusinessIdentityId(value: string): BusinessIdentityId {
  return nonEmpty(value, 'BusinessIdentityId');
}
