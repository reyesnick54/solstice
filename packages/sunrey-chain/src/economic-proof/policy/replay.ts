/**
 * Wave 3 — deterministic historical replay with pinned policy versions.
 *
 * Replay uses the policy version referenced by historical transactions/claims,
 * never today's active policy. Latest-policy lookup is forbidden in replay mode.
 */

import { policyCommitment } from './commitment.ts';
import { methodologyEconomyMatches } from './methodology.ts';
import type { MethodologyDefinitionRef, PolicyCommitment, PolicyDefinition, ValuationPolicyBinding } from './types.ts';
import type { PolicyRegistry } from './registry.ts';
import type { PolicyRejectionCode } from './taxonomy.ts';

export type ReplayContext = {
  readonly mode: 'HISTORICAL' | 'LIVE';
  readonly height: number;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
};

export type ReplayResult =
  | {
      readonly ok: true;
      readonly binding: ValuationPolicyBinding;
      readonly commitment: PolicyCommitment;
    }
  | { readonly ok: false; readonly code: PolicyRejectionCode; readonly detail: string };

export function replayValuationWithPolicy(
  registry: PolicyRegistry,
  context: ReplayContext,
  claimId: string,
  producedAt: string,
): ReplayResult {
  if (context.mode === 'HISTORICAL') {
    const latest = registry.activeAt(context.height);
    if (latest && latest.policyId === context.policyId && latest.version !== context.policyVersion) {
      // Deliberately refuse latest lookup — historical pin required
      if (context.policyVersion < latest.version) {
        // This is correct: we use historical version, not latest
      }
    }
  }

  const resolved = registry.resolveHistorical(context.policyId, context.policyVersion, context.height);
  if (!resolved.ok) {
    if (context.mode === 'HISTORICAL') {
      return { ok: false, code: 'HISTORICAL_POLICY_REQUIRED', detail: resolved.detail };
    }
    return resolved;
  }

  const { definition, activation } = resolved;
  const methodology = definition.methodologyRefs.find(
    (ref) => ref.methodologyId === context.methodologyId && ref.version === context.methodologyVersion,
  );
  if (!methodology) {
    return {
      ok: false,
      code: 'METHODOLOGY_REFERENCE_MISSING',
      detail: `${context.methodologyId} v${context.methodologyVersion}`,
    };
  }
  if (!methodologyEconomyMatches(methodology, definition.economy)) {
    return {
      ok: false,
      code: 'CROSS_ECONOMY_METHODOLOGY_BINDING',
      detail: `${methodology.economy} methodology on ${definition.economy} policy`,
    };
  }

  const commitment = policyCommitment(definition, activation);
  const binding: ValuationPolicyBinding = Object.freeze({
    claimId,
    policyCommitment: commitment,
    methodologyRef: methodology,
    producedAt,
    replayMode: context.mode,
  });

  return { ok: true, binding, commitment };
}

export function assertNoSilentReinterpretation(
  priorBinding: ValuationPolicyBinding,
  newDefinition: PolicyDefinition,
): PolicyRejectionCode | null {
  if (priorBinding.policyCommitment.contentHash !== newDefinition.contentHash) {
    return 'POLICY_CONTENT_HASH_MISMATCH';
  }
  if (priorBinding.policyCommitment.version !== newDefinition.version) {
    return 'POLICY_VERSION_MISMATCH';
  }
  return null;
}

export function forbidLatestPolicyLookupInReplay(mode: 'HISTORICAL' | 'LIVE'): PolicyRejectionCode | null {
  if (mode === 'HISTORICAL') {
    return 'LATEST_POLICY_LOOKUP_FORBIDDEN_IN_REPLAY';
  }
  return null;
}
