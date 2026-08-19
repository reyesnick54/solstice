import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import {
  hashValuationPolicy,
  validateValuationPolicy,
  type HumanContributionValuationPolicy,
  type RegisterableValuationPolicy,
} from './policy.ts';
import { valuationFailure, type ValuationFailure } from './types.ts';
import type { ValuationPolicyHash, ValuationPolicyId, ValuationPolicyVersion } from './ids.ts';

export type StoredValuationPolicy = {
  readonly policy: HumanContributionValuationPolicy;
  readonly hash: ValuationPolicyHash;
  readonly lifecycleStatus: HumanContributionValuationPolicy['status'];
};

export type ValuationRegistrySnapshot = {
  readonly policies: readonly StoredValuationPolicy[];
  readonly productionValuationActive: false;
  readonly valuationComputesSunReyQuantity: false;
};

function policyKey(policyId: ValuationPolicyId, version: ValuationPolicyVersion): string {
  return `${policyId}@${version}`;
}

export class HumanContributionValuationPolicyRegistry {
  private readonly records = new Map<string, StoredValuationPolicy>();

  register(input: RegisterableValuationPolicy): Result<StoredValuationPolicy, ValuationFailure> {
    const validated = validateValuationPolicy(input);
    if (!validated.ok) {
      return validated;
    }
    const key = policyKey(validated.value.policyId, validated.value.version);
    if (this.records.has(key)) {
      return err(valuationFailure('DUPLICATE_POLICY_VERSION', `policy ${key} is already registered and cannot be replaced`));
    }
    const stored = Object.freeze({
      policy: validated.value,
      hash: hashValuationPolicy(validated.value),
      lifecycleStatus: validated.value.status,
    });
    this.records.set(key, stored);
    return ok(stored);
  }

  get(policyId: ValuationPolicyId, version: ValuationPolicyVersion): Result<StoredValuationPolicy, ValuationFailure> {
    const stored = this.records.get(policyKey(policyId, version));
    if (!stored) {
      return err(valuationFailure('POLICY_NOT_FOUND', `policy ${policyId}@${version} is not registered`));
    }
    return ok(stored);
  }

  list(): readonly StoredValuationPolicy[] {
    return [...this.records.values()];
  }

  listByPolicyId(policyId: ValuationPolicyId): readonly StoredValuationPolicy[] {
    return this.list().filter((record) => record.policy.policyId === policyId);
  }

  supersede(
    policyId: ValuationPolicyId,
    version: ValuationPolicyVersion,
    successor: RegisterableValuationPolicy,
  ): Result<{ readonly previous: StoredValuationPolicy; readonly current: StoredValuationPolicy }, ValuationFailure> {
    const existing = this.get(policyId, version);
    if (!existing.ok) {
      return existing;
    }
    if (successor.policyId !== policyId) {
      return err(valuationFailure('INVALID_POLICY', 'successor must keep the same policyId'));
    }
    if (successor.version === version) {
      return err(valuationFailure('HISTORICAL_POLICY_IMMUTABLE', 'a successor must use a new version; historical policy cannot be mutated'));
    }
    const registered = this.register({ ...successor, status: successor.status === 'SUPERSEDED' ? 'SIMULATION' : successor.status });
    if (!registered.ok) {
      return registered;
    }
    const superseded: StoredValuationPolicy = Object.freeze({
      policy: existing.value.policy,
      hash: existing.value.hash,
      lifecycleStatus: 'SUPERSEDED',
    });
    this.records.set(policyKey(policyId, version), superseded);
    return ok({ previous: superseded, current: registered.value });
  }

  mutateHistorical(policyId: ValuationPolicyId, version: ValuationPolicyVersion): Result<never, ValuationFailure> {
    const existing = this.get(policyId, version);
    if (!existing.ok) {
      return existing;
    }
    return err(valuationFailure('HISTORICAL_POLICY_IMMUTABLE', `policy ${policyId}@${version} is immutable after registration`));
  }

  resolveActiveSimulation(
    contributionClass: ContributionClass,
    at: UtcInstant,
  ): Result<StoredValuationPolicy, ValuationFailure> {
    const matches = this.list().filter((record) => {
      if (record.lifecycleStatus === 'SUPERSEDED' || record.lifecycleStatus === 'PRODUCTION_CANDIDATE') {
        return false;
      }
      if (record.lifecycleStatus !== 'SIMULATION' && record.lifecycleStatus !== 'DEVELOPMENT') {
        return false;
      }
      if (record.policy.contributionClass !== contributionClass) {
        return false;
      }
      if (record.policy.effectiveFrom > at) {
        return false;
      }
      if (record.policy.effectiveUntil !== null && record.policy.effectiveUntil <= at) {
        return false;
      }
      return record.policy.productionActivated === false;
    });
    if (matches.length === 0) {
      return err(valuationFailure('NO_ACTIVE_SIMULATION_POLICY', `no active simulation policy for ${contributionClass}`));
    }
    matches.sort((left, right) => {
      const rightVersion = BigInt(right.policy.version);
      const leftVersion = BigInt(left.policy.version);
      if (rightVersion > leftVersion) {
        return 1;
      }
      if (rightVersion < leftVersion) {
        return -1;
      }
      return right.policy.effectiveFrom.localeCompare(left.policy.effectiveFrom);
    });
    const selected = matches[0];
    if (!selected) {
      return err(valuationFailure('NO_ACTIVE_SIMULATION_POLICY', `no active simulation policy for ${contributionClass}`));
    }
    return ok(selected);
  }

  resolveActiveProduction(): Result<never, ValuationFailure> {
    return err(valuationFailure('PRODUCTION_POLICY_UNAVAILABLE', 'production valuation policy is not configured'));
  }

  activateProduction(): Result<never, ValuationFailure> {
    return err(valuationFailure('PRODUCTION_ACTIVATION_FORBIDDEN', 'AI and this registry cannot activate production valuation policy'));
  }

  snapshot(): ValuationRegistrySnapshot {
    return Object.freeze({
      policies: this.list(),
      productionValuationActive: false,
      valuationComputesSunReyQuantity: false,
    });
  }
}
