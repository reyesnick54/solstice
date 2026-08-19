import { createHash } from 'node:crypto';

import { developmentIssuancePolicy, policyAtHeight, type MoonReyIssuancePolicy } from '../policy.ts';
import { PRODUCTIVE_CATEGORIES } from '../types.ts';
import { developmentAttributionPolicy } from './attribution/policy.ts';
import type { ProductiveAttributionPolicy } from './attribution/types.ts';
import { developmentBudgetPolicy, productionBudgetPolicy } from './budget.ts';
import { developmentCategoryPolicies } from './categories.ts';
import { developmentEligibilityPolicy } from './eligibility.ts';
import { developmentNormalizationRules } from './normalization.ts';
import {
  POLICY_GOVERNANCE_DOMAIN,
  POLICY_GOVERNANCE_SCHEMA_VERSION,
  type GovernanceActorKind,
  type MoonReyIssuancePolicyBundle,
  type PolicyActivationRecord,
  type PolicyRejectionCode,
} from './types.ts';

export function hashPolicyBundle(bundle: Omit<MoonReyIssuancePolicyBundle, 'contentHash'> | MoonReyIssuancePolicyBundle): string {
  const { contentHash: _ignored, ...rest } = bundle as MoonReyIssuancePolicyBundle;
  void _ignored;
  return createHash('sha256').update(`${POLICY_GOVERNANCE_DOMAIN}|${stable(rest)}`).digest('hex');
}

export function developmentPolicyBundle(
  activationHeight = 1,
  policyVersion = 1,
): MoonReyIssuancePolicyBundle {
  const issuance = developmentIssuancePolicy(activationHeight);
  const draft: Omit<MoonReyIssuancePolicyBundle, 'contentHash'> = {
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    policyVersion,
    activationHeight,
    epochLengthHeights: 100,
    eligibleCategories: PRODUCTIVE_CATEGORIES,
    categoryPolicies: developmentCategoryPolicies(activationHeight, policyVersion),
    normalizationRules: developmentNormalizationRules(activationHeight, policyVersion),
    eligibility: developmentEligibilityPolicy(policyVersion, issuance),
    budget: developmentBudgetPolicy(policyVersion),
    referenceFactKeys: [],
    crossCategoryAllocations: [],
    capacityOutputAllocations: [],
    concentrationWarnBps: 4_000,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
    roundingMode: issuance.roundingMode,
  };
  return Object.freeze({ ...draft, contentHash: hashPolicyBundle(draft) });
}

export function productionUnconfiguredBundle(
  activationHeight: number,
  policyVersion: number,
): MoonReyIssuancePolicyBundle {
  const base = developmentPolicyBundle(activationHeight, policyVersion);
  const draft: Omit<MoonReyIssuancePolicyBundle, 'contentHash'> = {
    ...base,
    budget: productionBudgetPolicy(policyVersion),
  };
  return Object.freeze({ ...draft, contentHash: hashPolicyBundle(draft) });
}

export class MoonReyPolicyRegistry {
  private readonly bundles: MoonReyIssuancePolicyBundle[] = [];
  private readonly activations: PolicyActivationRecord[] = [];
  private readonly issuancePolicies: MoonReyIssuancePolicy[] = [];
  private readonly attributionPolicies: ProductiveAttributionPolicy[] = [];

  constructor(
    seed?: readonly MoonReyIssuancePolicyBundle[],
    issuance?: readonly MoonReyIssuancePolicy[],
    attribution?: readonly ProductiveAttributionPolicy[],
  ) {
    for (const bundle of seed ?? [developmentPolicyBundle()]) {
      this.bundles.push(bundle);
    }
    for (const policy of issuance ?? [developmentIssuancePolicy()]) {
      this.issuancePolicies.push(policy);
    }
    for (const policy of attribution ?? [developmentAttributionPolicy()]) {
      this.attributionPolicies.push(policy);
    }
  }

  list(): readonly MoonReyIssuancePolicyBundle[] {
    return [...this.bundles];
  }

  get(policyVersion: number): MoonReyIssuancePolicyBundle | undefined {
    return this.bundles.find((bundle) => bundle.policyVersion === policyVersion);
  }

  activeAt(height: number): MoonReyIssuancePolicyBundle | undefined {
    return [...this.bundles]
      .filter((bundle) => bundle.activationHeight <= height)
      .sort((left, right) => {
        if (left.activationHeight !== right.activationHeight) {
          return right.activationHeight - left.activationHeight;
        }
        return right.policyVersion - left.policyVersion;
      })[0];
  }

  issuanceAt(height: number): MoonReyIssuancePolicy | undefined {
    return policyAtHeight(this.issuancePolicies, height);
  }

  propose(bundle: MoonReyIssuancePolicyBundle, actorKind: GovernanceActorKind, actorId: string): PolicyActivationRecord {
    if (actorKind === 'AI_PROPOSAL') {
      const record = Object.freeze({
        policyVersion: bundle.policyVersion,
        contentHash: bundle.contentHash,
        activationHeight: bundle.activationHeight,
        actorKind,
        actorId,
        activated: false,
        rejection: 'AI_CANNOT_ACTIVATE_POLICY' as PolicyRejectionCode,
      });
      this.activations.push(record);
      return record;
    }
    const existing = this.get(bundle.policyVersion);
    if (existing && existing.contentHash !== bundle.contentHash) {
      const record = Object.freeze({
        policyVersion: bundle.policyVersion,
        contentHash: bundle.contentHash,
        activationHeight: bundle.activationHeight,
        actorKind,
        actorId,
        activated: false,
        rejection: 'POLICY_REPLAY' as PolicyRejectionCode,
      });
      this.activations.push(record);
      return record;
    }
    if (!existing) {
      this.bundles.push(bundle);
    }
    const record = Object.freeze({
      policyVersion: bundle.policyVersion,
      contentHash: bundle.contentHash,
      activationHeight: bundle.activationHeight,
      actorKind,
      actorId,
      activated: true,
    });
    this.activations.push(record);
    return record;
  }

  resolveRequested(height: number, requestedVersion: number):
    | { readonly ok: true; readonly bundle: MoonReyIssuancePolicyBundle }
    | { readonly ok: false; readonly code: PolicyRejectionCode } {
    const requested = this.get(requestedVersion);
    if (!requested) {
      return { ok: false, code: 'WRONG_POLICY_VERSION' };
    }
    if (requested.activationHeight > height) {
      return { ok: false, code: 'POLICY_NOT_YET_ACTIVE' };
    }
    const active = this.activeAt(height);
    if (!active) {
      return { ok: false, code: 'POLICY_NOT_YET_ACTIVE' };
    }
    if (requested.policyVersion !== active.policyVersion) {
      return { ok: false, code: requested.policyVersion < active.policyVersion ? 'POLICY_REPLAY' : 'POLICY_NOT_YET_ACTIVE' };
    }
    return { ok: true, bundle: requested };
  }

  activationHistory(): readonly PolicyActivationRecord[] {
    return [...this.activations];
  }

  listAttributionPolicies(): readonly ProductiveAttributionPolicy[] {
    return [...this.attributionPolicies];
  }

  getAttribution(policyId: string, version: number): ProductiveAttributionPolicy | undefined {
    return this.attributionPolicies.find((policy) => policy.policyId === policyId && policy.version === version);
  }

  attributionActiveAt(height: number): ProductiveAttributionPolicy | undefined {
    return [...this.attributionPolicies]
      .filter((policy) => policy.effectiveHeight <= height && policy.status === 'SIMULATION_ACTIVE')
      .sort((left, right) => {
        if (left.effectiveHeight !== right.effectiveHeight) {
          return right.effectiveHeight - left.effectiveHeight;
        }
        return right.version - left.version;
      })[0];
  }

  proposeAttribution(
    policy: ProductiveAttributionPolicy,
    actorKind: GovernanceActorKind,
    actorId: string,
  ): PolicyActivationRecord {
    if (actorKind === 'AI_PROPOSAL') {
      const record = Object.freeze({
        policyVersion: policy.version,
        contentHash: policy.contentHash,
        activationHeight: policy.effectiveHeight,
        actorKind,
        actorId,
        activated: false,
        rejection: 'AI_CANNOT_ACTIVATE_POLICY' as PolicyRejectionCode,
        policyKind: 'ATTRIBUTION_POLICY' as const,
        policyId: policy.policyId,
      });
      this.activations.push(record);
      return record;
    }
    const existing = this.getAttribution(policy.policyId, policy.version);
    if (existing && existing.contentHash !== policy.contentHash) {
      const record = Object.freeze({
        policyVersion: policy.version,
        contentHash: policy.contentHash,
        activationHeight: policy.effectiveHeight,
        actorKind,
        actorId,
        activated: false,
        rejection: 'POLICY_REPLAY' as PolicyRejectionCode,
        policyKind: 'ATTRIBUTION_POLICY' as const,
        policyId: policy.policyId,
      });
      this.activations.push(record);
      return record;
    }
    if (!existing) {
      this.attributionPolicies.push(policy);
    }
    const record = Object.freeze({
      policyVersion: policy.version,
      contentHash: policy.contentHash,
      activationHeight: policy.effectiveHeight,
      actorKind,
      actorId,
      activated: true,
      policyKind: 'ATTRIBUTION_POLICY' as const,
      policyId: policy.policyId,
    });
    this.activations.push(record);
    return record;
  }
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
