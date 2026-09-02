import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../../domain/src/brand.ts';

export type RightsGrantId = Brand<string, 'RightsGrantId'>;
export type ConsentGrantId = Brand<string, 'ConsentGrantId'>;
export type PurposeAuthorizationId = Brand<string, 'PurposeAuthorizationId'>;
export type LicenseAuthorizationId = Brand<string, 'LicenseAuthorizationId'>;
export type RightsCommitmentId = Brand<string, 'RightsCommitmentId'>;
export type RightsRevocationId = Brand<string, 'RightsRevocationId'>;
export type RightsDeltaId = Brand<string, 'RightsDeltaId'>;

export const RIGHTS_ID_PREFIXES = Object.freeze({
  rightsGrant: 'rgt_',
  consentGrant: 'csg_',
  purpose: 'pur_',
  license: 'lic_',
  commitment: 'rcm_',
  revocation: 'rvk_',
  delta: 'rdl_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
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

export function asRightsGrantId(value: string): RightsGrantId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.rightsGrant, 'RightsGrantId');
}

export function asConsentGrantId(value: string): ConsentGrantId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.consentGrant, 'ConsentGrantId');
}

export function asPurposeAuthorizationId(value: string): PurposeAuthorizationId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.purpose, 'PurposeAuthorizationId');
}

export function asLicenseAuthorizationId(value: string): LicenseAuthorizationId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.license, 'LicenseAuthorizationId');
}

export function asRightsCommitmentId(value: string): RightsCommitmentId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.commitment, 'RightsCommitmentId');
}

export function asRightsRevocationId(value: string): RightsRevocationId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.revocation, 'RightsRevocationId');
}

export function asRightsDeltaId(value: string): RightsDeltaId {
  return asPrefixedHex(value, RIGHTS_ID_PREFIXES.delta, 'RightsDeltaId');
}

export function newRightsGrantId(seed: string): RightsGrantId {
  return asRightsGrantId(`${RIGHTS_ID_PREFIXES.rightsGrant}${digest(`rights-grant:${seed}`)}`);
}

export function newConsentGrantId(seed: string): ConsentGrantId {
  return asConsentGrantId(`${RIGHTS_ID_PREFIXES.consentGrant}${digest(`consent-grant:${seed}`)}`);
}

export function newPurposeAuthorizationId(code: string, version: number): PurposeAuthorizationId {
  return asPurposeAuthorizationId(`${RIGHTS_ID_PREFIXES.purpose}${digest(`purpose:${code}:${version}`)}`);
}

export function newLicenseAuthorizationId(seed: string): LicenseAuthorizationId {
  return asLicenseAuthorizationId(`${RIGHTS_ID_PREFIXES.license}${digest(`license:${seed}`)}`);
}

export function newRightsCommitmentId(seed: string): RightsCommitmentId {
  return asRightsCommitmentId(`${RIGHTS_ID_PREFIXES.commitment}${digest(`rights-commitment:${seed}`)}`);
}

export function newRightsRevocationId(seed: string): RightsRevocationId {
  return asRightsRevocationId(`${RIGHTS_ID_PREFIXES.revocation}${digest(`rights-revocation:${seed}`)}`);
}

export function newRightsDeltaId(seed: string): RightsDeltaId {
  return asRightsDeltaId(`${RIGHTS_ID_PREFIXES.delta}${digest(`rights-delta:${seed}`)}`);
}
