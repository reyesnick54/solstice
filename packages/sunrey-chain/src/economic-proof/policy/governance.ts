/**
 * Wave 3 — governance decision references for policy activation.
 */

import { createHash } from 'node:crypto';

import type { GovernanceDecisionRef } from './types.ts';

export const GOVERNANCE_DECISION_DOMAIN = 'SUNREY_GOVERNANCE_DECISION_REF_V1' as const;

export function hashGovernanceDecisionRef(
  ref: Omit<GovernanceDecisionRef, 'contentHash'> | GovernanceDecisionRef,
): string {
  const { contentHash: _ignored, ...rest } = ref as GovernanceDecisionRef;
  void _ignored;
  return createHash('sha256')
    .update(`${GOVERNANCE_DECISION_DOMAIN}|${stable(rest)}`)
    .digest('hex');
}

export function buildGovernanceDecisionRef(input: {
  readonly decisionId: string;
  readonly governancePolicyVersion: number;
  readonly evidenceReferences?: readonly string[];
  readonly authorizedAtHeight: number;
  readonly actorKind: GovernanceDecisionRef['actorKind'];
}): GovernanceDecisionRef {
  const draft: Omit<GovernanceDecisionRef, 'contentHash'> = {
    decisionId: input.decisionId,
    governancePolicyVersion: input.governancePolicyVersion,
    evidenceReferences: [...(input.evidenceReferences ?? [])].sort(),
    authorizedAtHeight: input.authorizedAtHeight,
    actorKind: input.actorKind,
  };
  return Object.freeze({ ...draft, contentHash: hashGovernanceDecisionRef(draft) });
}

export function verifyGovernanceDecisionRef(ref: GovernanceDecisionRef): boolean {
  return hashGovernanceDecisionRef(ref) === ref.contentHash;
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
