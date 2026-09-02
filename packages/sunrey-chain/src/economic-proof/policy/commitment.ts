/**
 * Wave 3 — deterministic PolicyCommitment.
 *
 * Commits policy id, version, content hash, effective range, governance
 * authorization, and methodology references. Full proprietary methodologies
 * stay off-chain; commitment/reference is sufficient.
 */

import { createHash } from 'node:crypto';

import { POLICY_COMMITMENT_DOMAIN } from './taxonomy.ts';
import { verifyGovernanceDecisionRef } from './governance.ts';
import { verifyPolicyDefinition } from './definition.ts';
import type { PolicyActivation, PolicyCommitment, PolicyDefinition } from './types.ts';

export function policyCommitment(
  definition: PolicyDefinition,
  activation: PolicyActivation,
): PolicyCommitment {
  if (!verifyPolicyDefinition(definition)) {
    throw new Error('policy definition content hash mismatch');
  }
  if (!verifyGovernanceDecisionRef(activation.governanceAuthorizationRef)) {
    throw new Error('governance authorization reference invalid');
  }
  if (definition.policyId !== activation.policyId || definition.version !== activation.version) {
    throw new Error('activation does not match policy definition');
  }
  if (definition.contentHash !== activation.contentHash) {
    throw new Error('activation content hash does not match definition');
  }

  const body = Object.freeze({
    domain: POLICY_COMMITMENT_DOMAIN,
    policyId: definition.policyId,
    policyType: definition.policyType,
    version: definition.version,
    contentHash: definition.contentHash,
    economy: definition.economy,
    effectiveFrom: activation.effectiveFrom,
    effectiveUntil: activation.effectiveUntil,
    governanceAuthorizationRef: activation.governanceAuthorizationRef,
    methodologyRefs: [...definition.methodologyRefs].sort((left, right) =>
      left.methodologyId.localeCompare(right.methodologyId),
    ),
  });

  const commitmentHash = createHash('sha256').update(stable(body)).digest('hex');
  return Object.freeze({ ...body, commitmentHash });
}

export function verifyPolicyCommitment(commitment: PolicyCommitment): boolean {
  const { commitmentHash, ...body } = commitment;
  const expected = createHash('sha256').update(stable(body)).digest('hex');
  return commitmentHash === expected && verifyGovernanceDecisionRef(commitment.governanceAuthorizationRef);
}

export function policyCommitmentFromParts(input: {
  readonly definition: PolicyDefinition;
  readonly activation: PolicyActivation;
}): PolicyCommitment {
  return policyCommitment(input.definition, input.activation);
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
