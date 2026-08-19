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

export function asValuationPolicyId(value: string): ValuationPolicyId {
  return asPrefixedHex(value, VALUATION_ID_PREFIXES.policy, 'ValuationPolicyId');
}

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
