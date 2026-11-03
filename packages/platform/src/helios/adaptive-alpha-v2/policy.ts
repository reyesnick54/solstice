import { createHash } from 'node:crypto';

import {
  ADAPTIVE_ALPHA_MANDATORY_GATES,
  type AdaptiveAlphaQualificationPolicy,
} from './types.ts';

export const ADAPTIVE_ALPHA_QUALIFICATION_POLICY_VERSION = 'aaf-v2.6-qualification-v1' as const;

const POLICY_BODY = Object.freeze({
  mandatoryGates: ADAPTIVE_ALPHA_MANDATORY_GATES,
  allowWarningWithControlledReview: true,
  agentWaiveForbidden: true as const,
  grantsExecutionAuthority: false as const,
});

function policyHash(
  body: Omit<AdaptiveAlphaQualificationPolicy, 'policyId' | 'policyHash'>,
): string {
  return createHash('sha256')
    .update(JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)))
    .digest('hex');
}

export function createAdaptiveAlphaQualificationPolicy(
  overrides: Partial<
    Pick<AdaptiveAlphaQualificationPolicy, 'allowWarningWithControlledReview' | 'mandatoryGates'>
  > = {},
): AdaptiveAlphaQualificationPolicy {
  const body = {
    version: ADAPTIVE_ALPHA_QUALIFICATION_POLICY_VERSION,
    ...POLICY_BODY,
    ...overrides,
    mandatoryGates: Object.freeze([...(overrides.mandatoryGates ?? POLICY_BODY.mandatoryGates)]),
  };
  const hash = policyHash(body);
  return Object.freeze({
    policyId: `aaf-v2-pol_${hash.slice(0, 16)}`,
    policyHash: hash,
    ...body,
  });
}

export const DEFAULT_ADAPTIVE_ALPHA_QUALIFICATION_POLICY = createAdaptiveAlphaQualificationPolicy();
