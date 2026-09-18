import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { createJurisdictionCapabilityFramework, type JurisdictionCapabilityFramework } from './create.ts';
import { sealCapabilityDecision } from './evidence.ts';
import { canPerform } from './query.ts';
import type { CapabilityAction } from './taxonomy.ts';
import type { CanPerformInput, CanPerformResult } from './types.ts';

export type KernelHeliosCapabilityPortOptions = {
  readonly framework?: JurisdictionCapabilityFramework;
  readonly vault?: EvidenceVault;
};

/**
 * Kernel-side adapter implementing the HELIOS jurisdiction capability port.
 * Wired at orchestration layer (BFF/API/tests), not inside packages/platform.
 */
export function createKernelHeliosCapabilityPort(options: KernelHeliosCapabilityPortOptions = {}) {
  const framework = options.framework ?? createJurisdictionCapabilityFramework();
  const vault = options.vault;

  return Object.freeze({
    framework,
    query(input: {
      readonly legalEntityId: string;
      readonly customerId: string;
      readonly customerClass: string;
      readonly jurisdiction: string;
      readonly productId: string;
      readonly action: string;
      readonly accountId: string;
      readonly accountClass: string;
      readonly providerId?: string;
      readonly instrumentClass?: string;
      readonly environment: 'simulation' | 'live';
      readonly stateOverlay?: string;
      readonly memberState?: string;
      readonly at: UtcInstant;
    }): CanPerformResult {
      const query = Object.freeze({
        ...input,
        action: input.action as CapabilityAction,
      }) satisfies CanPerformInput;
      const result = canPerform(framework.registry, query);
      framework.store.recordDecision(query, result, input.at);
      if (vault) {
        sealCapabilityDecision({ vault, query, result, at: input.at });
      }
      return result;
    },
  });
}
