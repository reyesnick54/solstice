import { developmentIssuancePolicy } from '../policy.ts';
import { PRODUCTIVE_CATEGORIES, WEIGHT_SCALE, type ProductiveCategory } from '../types.ts';
import { defaultUnitRegistry } from '../units.ts';
import {
  POLICY_GOVERNANCE_SCHEMA_VERSION,
  PRODUCTIVE_DOMAIN_ALIASES,
  type PolicyFactor,
  type ProductiveCategoryPolicy,
  type ProductiveDomainAlias,
} from './types.ts';

export function canonicalCategory(name: string): ProductiveCategory | undefined {
  if ((PRODUCTIVE_CATEGORIES as readonly string[]).includes(name)) {
    return name as ProductiveCategory;
  }
  const aliased = PRODUCTIVE_DOMAIN_ALIASES[name as ProductiveDomainAlias];
  return aliased;
}

export function aliasesFor(category: ProductiveCategory): readonly ProductiveDomainAlias[] {
  return (Object.entries(PRODUCTIVE_DOMAIN_ALIASES) as readonly [ProductiveDomainAlias, ProductiveCategory][])
    .filter(([, mapped]) => mapped === category)
    .map(([alias]) => alias);
}

export function boundedFactor(factorId: string, version: number, value: bigint): PolicyFactor {
  return Object.freeze({
    factorId,
    version,
    value,
    min: 0n,
    max: 2_000_000n,
    auditable: true,
  });
}

export function developmentCategoryPolicy(
  category: ProductiveCategory,
  activationHeight = 1,
  policyVersion = 1,
): ProductiveCategoryPolicy {
  const issuance = developmentIssuancePolicy(activationHeight);
  const units = defaultUnitRegistry.unitsFor(category);
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    category,
    aliases: aliasesFor(category),
    eligible: issuance.eligibleCategories.includes(category),
    sourceUnits: units.map((unit) => unit.unitId),
    baseUnitId: units[0]?.baseUnitId ?? category,
    unitNormalization: boundedFactor(`${category}.unit`, policyVersion, WEIGHT_SCALE),
    quality: boundedFactor(`${category}.quality`, policyVersion, WEIGHT_SCALE),
    verifiedDeliveryState: boundedFactor(`${category}.delivery`, policyVersion, WEIGHT_SCALE),
    economicCategory: boundedFactor(`${category}.category`, policyVersion, issuance.categoryWeight[category]),
    activationHeight,
    policyVersion,
  });
}

export function developmentCategoryPolicies(
  activationHeight = 1,
  policyVersion = 1,
): readonly ProductiveCategoryPolicy[] {
  return Object.freeze(PRODUCTIVE_CATEGORIES.map((category) => developmentCategoryPolicy(category, activationHeight, policyVersion)));
}

export function categoryPolicyAt(
  policies: readonly ProductiveCategoryPolicy[],
  category: ProductiveCategory,
  height: number,
): ProductiveCategoryPolicy | undefined {
  return [...policies]
    .filter((policy) => policy.category === category && policy.activationHeight <= height)
    .sort((left, right) => right.activationHeight - left.activationHeight || right.policyVersion - left.policyVersion)[0];
}
