import { type Brand, brandAs } from '../../domain/src/brand.ts';
import { newSecurityToken } from '../../security/src/random.ts';

export type ConsentId = Brand<string, 'ConsentId'>;
export type ConsentVersion = Brand<string, 'ConsentVersion'>;
export type ConsentGrantId = Brand<string, 'ConsentGrantId'>;
export type ConsentReceiptId = Brand<string, 'ConsentReceiptId'>;
export type PurposeId = Brand<string, 'PurposeId'>;
export type PurposeVersion = Brand<string, 'PurposeVersion'>;
export type PurposePolicyId = Brand<string, 'PurposePolicyId'>;
export type DataUsePermitId = Brand<string, 'DataUsePermitId'>;
export type ConsentDecisionId = Brand<string, 'ConsentDecisionId'>;
export type ConsentRevocationId = Brand<string, 'ConsentRevocationId'>;
export type RecipientId = Brand<string, 'RecipientId'>;
export type DataScopeId = Brand<string, 'DataScopeId'>;

export const CONSENT_ID_PREFIXES = Object.freeze({
  consent: 'cns_',
  version: 'cnsv_',
  grant: 'cng_',
  receipt: 'cnr_',
  purpose: 'pur_',
  purposeVersion: 'purv_',
  policy: 'pol_',
  permit: 'dup_',
  decision: 'cnd_',
  revocation: 'cnx_',
  recipient: 'rcp_',
  scope: 'scp_',
});

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asConsentId(value: string): ConsentId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.consent, 'ConsentId');
}
export function asConsentVersion(value: string): ConsentVersion {
  return asPrefixed(value, CONSENT_ID_PREFIXES.version, 'ConsentVersion');
}
export function asConsentGrantId(value: string): ConsentGrantId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.grant, 'ConsentGrantId');
}
export function asConsentReceiptId(value: string): ConsentReceiptId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.receipt, 'ConsentReceiptId');
}
export function asPurposeId(value: string): PurposeId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.purpose, 'PurposeId');
}
export function asPurposeVersion(value: string): PurposeVersion {
  return asPrefixed(value, CONSENT_ID_PREFIXES.purposeVersion, 'PurposeVersion');
}
export function asPurposePolicyId(value: string): PurposePolicyId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.policy, 'PurposePolicyId');
}
export function asDataUsePermitId(value: string): DataUsePermitId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.permit, 'DataUsePermitId');
}
export function asConsentDecisionId(value: string): ConsentDecisionId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.decision, 'ConsentDecisionId');
}
export function asConsentRevocationId(value: string): ConsentRevocationId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.revocation, 'ConsentRevocationId');
}
export function asRecipientId(value: string): RecipientId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.recipient, 'RecipientId');
}
export function asDataScopeId(value: string): DataScopeId {
  return asPrefixed(value, CONSENT_ID_PREFIXES.scope, 'DataScopeId');
}

export function newConsentId(): ConsentId {
  return asConsentId(`${CONSENT_ID_PREFIXES.consent}${newSecurityToken()}`);
}
export function newConsentVersion(consentId: ConsentId, sequence: number): ConsentVersion {
  return asConsentVersion(`${CONSENT_ID_PREFIXES.version}${consentId.slice(CONSENT_ID_PREFIXES.consent.length)}_${sequence}`);
}
export function newConsentGrantId(): ConsentGrantId {
  return asConsentGrantId(`${CONSENT_ID_PREFIXES.grant}${newSecurityToken()}`);
}
export function newConsentReceiptId(): ConsentReceiptId {
  return asConsentReceiptId(`${CONSENT_ID_PREFIXES.receipt}${newSecurityToken()}`);
}
export function newPurposePolicyId(): PurposePolicyId {
  return asPurposePolicyId(`${CONSENT_ID_PREFIXES.policy}${newSecurityToken()}`);
}
export function newDataUsePermitId(): DataUsePermitId {
  return asDataUsePermitId(`${CONSENT_ID_PREFIXES.permit}${newSecurityToken()}`);
}
export function newConsentDecisionId(): ConsentDecisionId {
  return asConsentDecisionId(`${CONSENT_ID_PREFIXES.decision}${newSecurityToken()}`);
}
export function newConsentRevocationId(): ConsentRevocationId {
  return asConsentRevocationId(`${CONSENT_ID_PREFIXES.revocation}${newSecurityToken()}`);
}
export function newDataScopeId(): DataScopeId {
  return asDataScopeId(`${CONSENT_ID_PREFIXES.scope}${newSecurityToken()}`);
}

export function purposeIdFor(code: string): PurposeId {
  return asPurposeId(`${CONSENT_ID_PREFIXES.purpose}${code.toLowerCase()}`);
}

export function purposeVersionFor(code: string, version: number): PurposeVersion {
  return asPurposeVersion(`${CONSENT_ID_PREFIXES.purposeVersion}${code.toLowerCase()}_${version}`);
}

export function recipientIdFor(code: string): RecipientId {
  return asRecipientId(`${CONSENT_ID_PREFIXES.recipient}${code}`);
}
