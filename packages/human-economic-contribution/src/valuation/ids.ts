import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type ValuationId = Brand<string, 'ValuationId'>;
export type ValuationPolicyId = Brand<string, 'ValuationPolicyId'>;
export type ValuationPolicyVersion = Brand<string, 'ValuationPolicyVersion'>;
export type ValuationReferenceId = Brand<string, 'ValuationReferenceId'>;
export type ValuationDigest = Brand<string, 'ValuationDigest'>;
export type PolicyRuleRef = Brand<string, 'PolicyRuleRef'>;
export type JurisdictionPolicyRef = Brand<string, 'JurisdictionPolicyRef'>;

export const VALUATION_ID_PREFIXES = Object.freeze({
  valuation: 'hcv_',
  policy: 'hcvp_',
  policyVersion: 'hcvpv_',
  reference: 'hcref_',
  digest: 'hcvd_',
  policyRule: 'hcvrule_',
  jurisdictionPolicy: 'hcvj_',
import { type Brand, brandAs } from '../../../domain/src/brand.ts';
import { sha256Canonical } from '../ids.ts';

export type ValuationPolicyId = Brand<string, 'ValuationPolicyId'>;
export type ValuationMethodologyId = Brand<string, 'ValuationMethodologyId'>;
export type ValuationPolicyVersion = Brand<string, 'ValuationPolicyVersion'>;
export type ValuationInputRef = Brand<string, 'ValuationInputRef'>;
export type ValuationPolicyHash = Brand<string, 'ValuationPolicyHash'>;

export const VALUATION_ID_PREFIXES = Object.freeze({
  policy: 'hcvp_',
  methodology: 'hcvm_',
  input: 'hcvi_',
  hash: 'hcvh_',
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

export function asValuationId(value: string): ValuationId {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.valuation, 'ValuationId');
}

export function asValuationPolicyId(value: string): ValuationPolicyId {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.policy, 'ValuationPolicyId');
}

export function asValuationPolicyVersion(value: string): ValuationPolicyVersion {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.policyVersion, 'ValuationPolicyVersion');
}

export function asValuationReferenceId(value: string): ValuationReferenceId {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.reference, 'ValuationReferenceId');
}

export function asValuationDigest(value: string): ValuationDigest {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.digest, 'ValuationDigest');
}

export function asPolicyRuleRef(value: string): PolicyRuleRef {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.policyRule, 'PolicyRuleRef');
}

export function asJurisdictionPolicyRef(value: string): JurisdictionPolicyRef {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.jurisdictionPolicy, 'JurisdictionPolicyRef');
}

export function valuationIdFor(seed: string): ValuationId {
  return asValuationId(`${VALUATION_ID_PREFIXES.valuation}${digest(`valuation:${seed}`).slice(0, 32)}`);
}

export function valuationPolicyIdFor(seed: string): ValuationPolicyId {
  return asValuationPolicyId(`${VALUATION_ID_PREFIXES.policy}${digest(`valuation-policy:${seed}`).slice(0, 32)}`);
}

export function valuationPolicyVersionFor(seed: string): ValuationPolicyVersion {
  return asValuationPolicyVersion(
    `${VALUATION_ID_PREFIXES.policyVersion}${digest(`valuation-policy-version:${seed}`).slice(0, 32)}`,
  );
}

export function valuationReferenceIdFor(seed: string): ValuationReferenceId {
  return asValuationReferenceId(`${VALUATION_ID_PREFIXES.reference}${digest(`valuation-reference:${seed}`).slice(0, 32)}`);
}

export function valuationDigestFor(material: string): ValuationDigest {
  return asValuationDigest(`${VALUATION_ID_PREFIXES.digest}${digest(material)}`);
}

export function policyRuleRefFor(seed: string): PolicyRuleRef {
  return asPolicyRuleRef(`${VALUATION_ID_PREFIXES.policyRule}${digest(`policy-rule:${seed}`).slice(0, 32)}`);
}

export function jurisdictionPolicyRefFor(seed: string): JurisdictionPolicyRef {
  return asJurisdictionPolicyRef(
    `${VALUATION_ID_PREFIXES.jurisdictionPolicy}${digest(`jurisdiction-policy:${seed}`).slice(0, 32)}`,
  );
}

export function sha256Canonical(value: string): string {
  return digest(value);
export function asValuationMethodologyId(value: string): ValuationMethodologyId {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.methodology, 'ValuationMethodologyId');
}

export function asValuationInputRef(value: string): ValuationInputRef {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.input, 'ValuationInputRef');
}

export function asValuationPolicyHash(value: string): ValuationPolicyHash {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.hash, 'ValuationPolicyHash');
}

export function asValuationPolicyVersion(value: string): ValuationPolicyVersion {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new TypeError('ValuationPolicyVersion must be a positive decimal integer string');
  }
  return brandAs<string, 'ValuationPolicyVersion'>(value);
}

export function valuationPolicyIdFor(seed: string): ValuationPolicyId {
  return asValuationPolicyId(`${VALUATION_ID_PREFIXES.policy}${sha256Canonical(`valuation-policy:${seed}`).slice(0, 32)}`);
}

export function valuationMethodologyIdFor(seed: string): ValuationMethodologyId {
  return asValuationMethodologyId(
    `${VALUATION_ID_PREFIXES.methodology}${sha256Canonical(`valuation-methodology:${seed}`).slice(0, 32)}`,
  );
}

export function valuationInputRefFor(seed: string): ValuationInputRef {
  return asValuationInputRef(`${VALUATION_ID_PREFIXES.input}${sha256Canonical(`valuation-input:${seed}`).slice(0, 32)}`);
}

export function valuationPolicyHashFor(material: string): ValuationPolicyHash {
  return asValuationPolicyHash(`${VALUATION_ID_PREFIXES.hash}${sha256Canonical(material)}`);
}
