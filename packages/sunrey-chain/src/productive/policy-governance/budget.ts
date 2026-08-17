import { developmentIssuancePolicy } from '../policy.ts';
import { POLICY_GOVERNANCE_SCHEMA_VERSION, UNCONFIGURED, type BudgetBound, type IssuanceBudgetPolicy } from './types.ts';

export function developmentBudgetPolicy(policyVersion = 1): IssuanceBudgetPolicy {
  const issuance = developmentIssuancePolicy();
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    policyVersion,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    perContribution: issuance.maximumIssuancePerContribution,
    perProductiveObject: issuance.maximumIssuancePerObjectPerEpoch,
    perActor: issuance.maximumIssuancePerControllerPerEpoch,
    perCategory: issuance.maximumIssuancePerCategoryPerEpoch,
    perEpoch: issuance.maximumTotalIssuancePerEpoch,
    globalEpoch: issuance.maximumTotalIssuancePerEpoch,
    productionCaps: UNCONFIGURED,
  });
}

export function productionBudgetPolicy(policyVersion = 1): IssuanceBudgetPolicy {
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    policyVersion,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    perContribution: UNCONFIGURED,
    perProductiveObject: UNCONFIGURED,
    perActor: UNCONFIGURED,
    perCategory: UNCONFIGURED,
    perEpoch: UNCONFIGURED,
    globalEpoch: UNCONFIGURED,
    productionCaps: UNCONFIGURED,
  });
}

export function boundConfigured(bound: BudgetBound): bound is bigint {
  return bound !== UNCONFIGURED;
}

export function exceedsBound(used: bigint, increment: bigint, bound: BudgetBound): boolean {
  if (!boundConfigured(bound)) {
    return false;
  }
  return used + increment > bound;
}

export type BudgetUsage = {
  readonly contribution: bigint;
  readonly object: bigint;
  readonly actor: bigint;
  readonly category: bigint;
  readonly epoch: bigint;
  readonly globalEpoch: bigint;
};

export function emptyBudgetUsage(): BudgetUsage {
  return Object.freeze({
    contribution: 0n,
    object: 0n,
    actor: 0n,
    category: 0n,
    epoch: 0n,
    globalEpoch: 0n,
  });
}

export function evaluateBudget(
  policy: IssuanceBudgetPolicy,
  usage: BudgetUsage,
  increment: bigint,
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code:
        | 'CONTRIBUTION_CAP'
        | 'OBJECT_ISSUANCE_CAP'
        | 'ACTOR_ISSUANCE_CAP'
        | 'EPOCH_CATEGORY_CAP'
        | 'EPOCH_GLOBAL_CAP'
        | 'BUDGET_UNAVAILABLE';
    } {
  if (increment <= 0n) {
    return { ok: false, code: 'BUDGET_UNAVAILABLE' };
  }
  if (exceedsBound(0n, increment, policy.perContribution)) {
    return { ok: false, code: 'CONTRIBUTION_CAP' };
  }
  if (exceedsBound(usage.object, increment, policy.perProductiveObject)) {
    return { ok: false, code: 'OBJECT_ISSUANCE_CAP' };
  }
  if (exceedsBound(usage.actor, increment, policy.perActor)) {
    return { ok: false, code: 'ACTOR_ISSUANCE_CAP' };
  }
  if (exceedsBound(usage.category, increment, policy.perCategory)) {
    return { ok: false, code: 'EPOCH_CATEGORY_CAP' };
  }
  if (exceedsBound(usage.epoch, increment, policy.perEpoch) || exceedsBound(usage.globalEpoch, increment, policy.globalEpoch)) {
    return { ok: false, code: 'EPOCH_GLOBAL_CAP' };
  }
  return { ok: true };
}

export function utilizationBps(used: bigint, bound: BudgetBound): bigint | typeof UNCONFIGURED {
  if (!boundConfigured(bound) || bound === 0n) {
    return UNCONFIGURED;
  }
  return (used * 10_000n) / bound;
}
