/**
 * Wave 3 — immutable versioned policy definition hashing and builders.
 */

import { createHash } from 'node:crypto';

import { POLICY_SCHEMA_VERSION } from './taxonomy.ts';
import type { GovernanceDecisionRef, MethodologyDefinitionRef, PolicyDefinition } from './types.ts';
import type { PolicyEconomy, PolicyType } from './taxonomy.ts';

export const POLICY_DEFINITION_DOMAIN = 'SUNREY_POLICY_DEFINITION_V1' as const;

export function hashPolicyDefinition(
  definition: Omit<PolicyDefinition, 'contentHash'> | PolicyDefinition,
): string {
  const { contentHash: _ignored, ...rest } = definition as PolicyDefinition;
  void _ignored;
  return createHash('sha256')
    .update(`${POLICY_DEFINITION_DOMAIN}|${stable(rest)}`)
    .digest('hex');
}

export function buildPolicyDefinition(input: {
  readonly policyId: string;
  readonly policyType: PolicyType;
  readonly version: number;
  readonly economy: PolicyEconomy;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string | null;
  readonly documentRef: string;
  readonly supersedes?: { readonly policyId: string; readonly version: number } | null;
  readonly governanceAuthorizationRef?: GovernanceDecisionRef | null;
  readonly methodologyRefs?: readonly MethodologyDefinitionRef[];
  readonly parameterClass?: PolicyDefinition['parameterClass'];
}): PolicyDefinition {
  const draft: Omit<PolicyDefinition, 'contentHash'> = {
    schemaVersion: POLICY_SCHEMA_VERSION,
    policyId: input.policyId,
    policyType: input.policyType,
    version: input.version,
    economy: input.economy,
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil ?? null,
    status: 'REGISTERED',
    documentRef: input.documentRef,
    supersedes: input.supersedes ?? null,
    governanceAuthorizationRef: input.governanceAuthorizationRef ?? null,
    methodologyRefs: input.methodologyRefs ?? [],
    parameterClass: input.parameterClass ?? 'ENGINEERING_SIMULATION_PARAMETERS',
    simulationOnly: true,
    productionActivated: false,
  };
  return Object.freeze({ ...draft, contentHash: hashPolicyDefinition(draft) });
}

export function verifyPolicyDefinition(definition: PolicyDefinition): boolean {
  return hashPolicyDefinition(definition) === definition.contentHash;
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
