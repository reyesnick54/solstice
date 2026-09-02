import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type HumanEconomicIdentityId = Brand<string, 'HumanEconomicIdentityId'>;
export type IdentityLinkId = Brand<string, 'IdentityLinkId'>;
export type UniquenessProofId = Brand<string, 'UniquenessProofId'>;
export type IdentityRecoveryId = Brand<string, 'IdentityRecoveryId'>;
export type IdentityRevocationId = Brand<string, 'IdentityRevocationId'>;
export type SybilSignalId = Brand<string, 'SybilSignalId'>;

export const HUMAN_ECONOMIC_IDENTITY_PREFIXES = Object.freeze({
  humanActor: 'heaid_',
  link: 'helink_',
  uniquenessProof: 'heuniq_',
  recovery: 'herec_',
  revocation: 'herev_',
  sybilSignal: 'hesyb_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

export function asHumanEconomicIdentityId(value: string): HumanEconomicIdentityId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.humanActor, 'HumanEconomicIdentityId');
}

export function asIdentityLinkId(value: string): IdentityLinkId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.link, 'IdentityLinkId');
}

export function asUniquenessProofId(value: string): UniquenessProofId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.uniquenessProof, 'UniquenessProofId');
}

export function asIdentityRecoveryId(value: string): IdentityRecoveryId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.recovery, 'IdentityRecoveryId');
}

export function asIdentityRevocationId(value: string): IdentityRevocationId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.revocation, 'IdentityRevocationId');
}

export function asSybilSignalId(value: string): SybilSignalId {
  return asPrefixedHex(value, HUMAN_ECONOMIC_IDENTITY_PREFIXES.sybilSignal, 'SybilSignalId');
}

export function humanEconomicIdentityIdFor(seed: string): HumanEconomicIdentityId {
  return asHumanEconomicIdentityId(
    `${HUMAN_ECONOMIC_IDENTITY_PREFIXES.humanActor}${digest(`human-economic-identity:${seed}`).slice(0, 32)}`,
  );
}

export function identityLinkIdFor(seed: string): IdentityLinkId {
  return asIdentityLinkId(`${HUMAN_ECONOMIC_IDENTITY_PREFIXES.link}${digest(`identity-link:${seed}`).slice(0, 32)}`);
}

export function uniquenessProofIdFor(seed: string): UniquenessProofId {
  return asUniquenessProofId(
    `${HUMAN_ECONOMIC_IDENTITY_PREFIXES.uniquenessProof}${digest(`uniqueness-proof:${seed}`).slice(0, 32)}`,
  );
}

export function identityRecoveryIdFor(seed: string): IdentityRecoveryId {
  return asIdentityRecoveryId(
    `${HUMAN_ECONOMIC_IDENTITY_PREFIXES.recovery}${digest(`identity-recovery:${seed}`).slice(0, 32)}`,
  );
}

export function identityRevocationIdFor(seed: string): IdentityRevocationId {
  return asIdentityRevocationId(
    `${HUMAN_ECONOMIC_IDENTITY_PREFIXES.revocation}${digest(`identity-revocation:${seed}`).slice(0, 32)}`,
  );
}

export function sybilSignalIdFor(seed: string): SybilSignalId {
  return asSybilSignalId(`${HUMAN_ECONOMIC_IDENTITY_PREFIXES.sybilSignal}${digest(`sybil-signal:${seed}`).slice(0, 32)}`);
}
