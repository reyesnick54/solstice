import { type Brand, brandAs } from '../../../domain/src/brand.ts';
import { newSecurityToken } from '../../../security/src/random.ts';

export type RightsRequestId = Brand<string, 'RightsRequestId'>;
export type HinParticipationId = Brand<string, 'HinParticipationId'>;
export type LicenseGrantId = Brand<string, 'LicenseGrantId'>;
export type DelegationId = Brand<string, 'DelegationId'>;
export type AccessAuditId = Brand<string, 'AccessAuditId'>;
export type ProductGrantId = Brand<string, 'ProductGrantId'>;

const PREFIX = Object.freeze({
  rights: 'drr_',
  hin: 'hinp_',
  license: 'lic_',
  delegation: 'dlg_',
  audit: 'daa_',
  grant: 'pdg_',
});

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function newRightsRequestId(): RightsRequestId {
  return asPrefixed(`drr_${newSecurityToken()}`, PREFIX.rights, 'RightsRequestId');
}

export function newHinParticipationId(): HinParticipationId {
  return asPrefixed(`hinp_${newSecurityToken()}`, PREFIX.hin, 'HinParticipationId');
}

export function newLicenseGrantId(): LicenseGrantId {
  return asPrefixed(`lic_${newSecurityToken()}`, PREFIX.license, 'LicenseGrantId');
}

export function newDelegationId(): DelegationId {
  return asPrefixed(`dlg_${newSecurityToken()}`, PREFIX.delegation, 'DelegationId');
}

export function newAccessAuditId(): AccessAuditId {
  return asPrefixed(`daa_${newSecurityToken()}`, PREFIX.audit, 'AccessAuditId');
}

export function newProductGrantId(): ProductGrantId {
  return asPrefixed(`pdg_${newSecurityToken()}`, PREFIX.grant, 'ProductGrantId');
}
