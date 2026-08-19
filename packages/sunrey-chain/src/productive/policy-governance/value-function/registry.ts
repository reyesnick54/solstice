/**
 * Productive Value Function policy registry.
 *
 * Tightly coupled to MoonReyPolicyRegistry. AI may propose. AI cannot
 * activate. Historical policies are immutable. Production remains
 * unconfigured and inactive.
 */

import type { GovernanceActorKind } from '../types.ts';
import { rejectAiActivation, validatePolicy } from './invariants.ts';
import { developmentValueFunctionPolicy, hashValueFunctionPolicy } from './policy.ts';
import {
  PRODUCTION_VALUE_FUNCTION_POLICY,
  type ProductiveValueFunctionPolicy,
  type ValueFunctionActivationRecord,
  type ValueFunctionRejectionCode,
} from './types.ts';

export class ProductiveValueFunctionPolicyRegistry {
  private readonly policies: ProductiveValueFunctionPolicy[] = [];
  private readonly activations: ValueFunctionActivationRecord[] = [];

  constructor(seed?: readonly ProductiveValueFunctionPolicy[]) {
    for (const policy of seed ?? [developmentValueFunctionPolicy()]) {
      this.policies.push(policy);
    }
  }

  list(): readonly ProductiveValueFunctionPolicy[] {
    return [...this.policies];
  }

  get(policyId: string, policyVersion: number): ProductiveValueFunctionPolicy | undefined {
    return this.policies.find((policy) => policy.policyId === policyId && policy.policyVersion === policyVersion);
  }

  activeSimulationAt(height: number): ProductiveValueFunctionPolicy | undefined {
    return [...this.policies]
      .filter((policy) => policy.effectiveHeight <= height && policy.state !== 'SUPERSEDED')
      .sort((left, right) => {
        if (left.effectiveHeight !== right.effectiveHeight) {
          return right.effectiveHeight - left.effectiveHeight;
        }
        return right.policyVersion - left.policyVersion;
      })[0];
  }

  productionPolicy(): typeof PRODUCTION_VALUE_FUNCTION_POLICY {
    return PRODUCTION_VALUE_FUNCTION_POLICY;
  }

  propose(
    policy: ProductiveValueFunctionPolicy,
    actorKind: GovernanceActorKind,
    actorId: string,
  ): ValueFunctionActivationRecord {
    const ai = rejectAiActivation(actorKind);
    if (!ai.ok) {
      return this.record({
        policy,
        actorKind,
        actorId,
        activated: false,
        rejection: 'AI_CANNOT_ACTIVATE_POLICY',
      });
    }
    const validated = validatePolicy(policy);
    if (!validated.ok) {
      return this.record({
        policy,
        actorKind,
        actorId,
        activated: false,
        rejection: validated.code,
      });
    }
    const expectedHash = hashValueFunctionPolicy(policy);
    if (policy.contentHash !== expectedHash) {
      return this.record({
        policy,
        actorKind,
        actorId,
        activated: false,
        rejection: 'HISTORICAL_POLICY_IMMUTABLE',
      });
    }
    const existing = this.get(policy.policyId, policy.policyVersion);
    if (existing && existing.contentHash !== policy.contentHash) {
      return this.record({
        policy,
        actorKind,
        actorId,
        activated: false,
        rejection: 'HISTORICAL_POLICY_IMMUTABLE',
      });
    }
    if (policy.productionActivated || policy.state === 'PRODUCTION_CANDIDATE') {
      return this.record({
        policy,
        actorKind,
        actorId,
        activated: false,
        rejection: 'PRODUCTION_POLICY_INACTIVE',
      });
    }
    if (!existing) {
      this.policies.push(policy);
    }
    return this.record({
      policy,
      actorKind,
      actorId,
      activated: true,
    });
  }

  activationHistory(): readonly ValueFunctionActivationRecord[] {
    return [...this.activations];
  }

  private record(input: {
    readonly policy: ProductiveValueFunctionPolicy;
    readonly actorKind: GovernanceActorKind;
    readonly actorId: string;
    readonly activated: boolean;
    readonly rejection?: ValueFunctionRejectionCode;
  }): ValueFunctionActivationRecord {
    const record = Object.freeze({
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      contentHash: input.policy.contentHash,
      effectiveHeight: input.policy.effectiveHeight,
      actorKind: input.actorKind,
      actorId: input.actorId,
      activated: input.activated,
      ...(input.rejection ? { rejection: input.rejection } : {}),
    });
    this.activations.push(record);
    return record;
  }
}
