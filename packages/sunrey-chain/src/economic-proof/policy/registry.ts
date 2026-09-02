/**
 * Wave 3 — versioned policy registry.
 *
 * Policies are registered immutably. Activation is tracked separately.
 * Finalized monetary history references recoverable policy versions.
 */

import { policyCommitment } from './commitment.ts';
import { activatePolicy, isAuthorizedForMonetaryUseAt, isPolicyActiveAt } from './activation.ts';
import { verifyPolicyDefinition } from './definition.ts';
import type {
  GovernanceDecisionRef,
  PolicyActivation,
  PolicyActivationResult,
  PolicyCommitment,
  PolicyDefinition,
  PolicyResolutionResult,
} from './types.ts';
import type { PolicyActivationActorKind, PolicyRejectionCode } from './taxonomy.ts';

export class PolicyRegistry {
  private readonly definitions = new Map<string, PolicyDefinition>();
  private readonly activations: PolicyActivation[] = [];

  register(definition: PolicyDefinition): PolicyRejectionCode | null {
    if (!verifyPolicyDefinition(definition)) {
      return 'POLICY_CONTENT_HASH_MISMATCH';
    }
    const key = definitionKey(definition.policyId, definition.version);
    const existing = this.definitions.get(key);
    if (existing && existing.contentHash !== definition.contentHash) {
      return 'POLICY_REPLAY';
    }
    if (!existing) {
      this.definitions.set(key, Object.freeze({ ...definition }));
    }
    return null;
  }

  get(policyId: string, version: number): PolicyDefinition | undefined {
    return this.definitions.get(definitionKey(policyId, version));
  }

  listDefinitions(): readonly PolicyDefinition[] {
    return [...this.definitions.values()];
  }

  listActivations(): readonly PolicyActivation[] {
    return [...this.activations];
  }

  proposeActivation(input: {
    readonly policyId: string;
    readonly version: number;
    readonly activationHeight: number;
    readonly actorKind: PolicyActivationActorKind;
    readonly actorId: string;
    readonly governanceAuthorizationRef: GovernanceDecisionRef;
    readonly authorizedForMonetaryUse: boolean;
    readonly activatedAt: string;
  }): PolicyActivationResult {
    const definition = this.get(input.policyId, input.version);
    if (!definition) {
      return { ok: false, code: 'POLICY_NOT_FOUND', detail: input.policyId };
    }
    const result = activatePolicy({ ...input, definition });
    if (result.ok) {
      this.activations.push(result.activation);
    }
    return result;
  }

  activeAt(height: number, policyType?: PolicyDefinition['policyType']): PolicyDefinition | undefined {
    const active = [...this.activations]
      .filter((activation) => isPolicyActiveAt(activation, height))
      .filter((activation) => (policyType ? activation.policyType === policyType : true))
      .sort((left, right) => {
        if (left.activationHeight !== right.activationHeight) {
          return right.activationHeight - left.activationHeight;
        }
        return right.version - left.version;
      });
    const top = active[0];
    return top ? this.get(top.policyId, top.version) : undefined;
  }

  activeCommitmentsAt(height: number): readonly PolicyCommitment[] {
    const seen = new Set<string>();
    const commitments: PolicyCommitment[] = [];
    for (const activation of this.activations) {
      if (!isPolicyActiveAt(activation, height)) {
        continue;
      }
      const key = definitionKey(activation.policyId, activation.version);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const definition = this.get(activation.policyId, activation.version);
      if (!definition) {
        continue;
      }
      commitments.push(policyCommitment(definition, activation));
    }
    return commitments;
  }

  resolveAtHeight(
    height: number,
    policyId: string,
    version: number,
    options?: { readonly monetaryUse?: boolean },
  ): PolicyResolutionResult {
    const definition = this.get(policyId, version);
    if (!definition) {
      return { ok: false, code: 'POLICY_NOT_FOUND', detail: policyId };
    }
    const activation = this.activations.find(
      (item) => item.policyId === policyId && item.version === version && isPolicyActiveAt(item, height),
    );
    if (!activation) {
      return { ok: false, code: 'POLICY_NOT_ACTIVE', detail: `${policyId} v${String(version)}` };
    }
    if (options?.monetaryUse && !isAuthorizedForMonetaryUseAt(activation, height)) {
      return {
        ok: false,
        code: 'POLICY_NOT_AUTHORIZED_FOR_MONETARY_USE',
        detail: `${policyId} v${String(version)}`,
      };
    }
    return { ok: true, definition, activation };
  }

  resolveHistorical(
    policyId: string,
    version: number,
    atHeight: number,
  ): PolicyResolutionResult {
    return this.resolveAtHeight(atHeight, policyId, version, { monetaryUse: true });
  }
}

function definitionKey(policyId: string, version: number): string {
  return `${policyId}::${String(version)}`;
}
