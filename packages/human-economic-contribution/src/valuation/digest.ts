import { createHash } from 'node:crypto';

import type { HumanContributionValuationResult } from './types.ts';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function valuationDigestMaterial(input: {
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
}): string {
  return [
    'hcv.v1',
    input.valuationId,
    input.contributionId,
    input.fingerprint,
    input.valuationPolicyId,
    input.valuationPolicyVersion,
    input.valuationMethod,
    input.finalReferenceValue.toString(),
    input.referenceDenomination,
  ].join(':');
}

export function computeValuationDigest(input: {
  readonly valuationId: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly valuationPolicyId: string;
  readonly valuationPolicyVersion: string;
  readonly valuationMethod: string;
  readonly finalReferenceValue: bigint;
  readonly referenceDenomination: string;
}): string {
  return sha256Hex(valuationDigestMaterial(input));
}

export function valuationDigestOf(result: Pick<
  HumanContributionValuationResult,
  | 'valuationId'
  | 'contributionId'
  | 'fingerprint'
  | 'valuationPolicyId'
  | 'valuationPolicyVersion'
  | 'valuationMethod'
  | 'finalReferenceValue'
  | 'referenceDenomination'
>): string {
  return computeValuationDigest(result);
}
