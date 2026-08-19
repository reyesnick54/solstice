/**
 * Versioned simulation attribution policy.
 *
 * v1 is the historical engineering-simulation rule set. Later versions
 * may tighten shares or add splits. They do not rewrite v1 history.
 * No rule here is a permanent live economic policy.
 */

import { WEIGHT_SCALE } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../types.ts';
import {
  ATTRIBUTION_CONSTITUTION_VERSION,
  ATTRIBUTION_PARAMETER_CLASS,
  ATTRIBUTION_SHARE_SCALE,
} from './constitution.ts';
import { hashAttributionPolicy } from './digest.ts';
import type {
  CategoryRelationshipRule,
  ClaimRelationshipRule,
  EventClassRule,
  ProductiveAttributionPolicy,
} from './types.ts';

export const DEVELOPMENT_ATTRIBUTION_POLICY_ID = 'moonrey.attribution.simulation.v1' as const;

const EVENT_CLASS_RULES: readonly EventClassRule[] = Object.freeze([
  Object.freeze({
    ruleId: 'event-class.production-output',
    eventClass: 'PRODUCTION_OUTPUT',
    mayReceiveFullAttribution: true,
    isAutomaticProduction: false,
    notes: 'A realized production event may receive attribution for that event only.',
  }),
  Object.freeze({
    ruleId: 'event-class.capacity',
    eventClass: 'CAPACITY',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'CAPACITY_IS_NOT_OUTPUT. Capacity is not a second production credit.',
  }),
  Object.freeze({
    ruleId: 'event-class.consumption',
    eventClass: 'CONSUMPTION',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'Consumption of another controller\'s output is lineage, not ownership.',
  }),
  Object.freeze({
    ruleId: 'event-class.usage',
    eventClass: 'USAGE',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'Usage is not automatically new production.',
  }),
  Object.freeze({
    ruleId: 'event-class.delivery',
    eventClass: 'DELIVERY',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'DELIVERY_IS_NOT_AUTOMATICALLY_NEW_PRODUCTION. Independent logistics may qualify separately.',
  }),
  Object.freeze({
    ruleId: 'event-class.reserve',
    eventClass: 'RESERVE',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'Reserve is not production.',
  }),
  Object.freeze({
    ruleId: 'event-class.reference',
    eventClass: 'REFERENCE',
    mayReceiveFullAttribution: false,
    isAutomaticProduction: false,
    notes: 'Reference facts do not receive productive attribution.',
  }),
]);

function pair(
  ruleId: string,
  left: ProductiveCategory,
  right: ProductiveCategory,
  relationship: CategoryRelationshipRule['relationship'],
  behavior: CategoryRelationshipRule['behavior'],
  extra: Partial<CategoryRelationshipRule> = {},
): CategoryRelationshipRule {
  return Object.freeze({
    ruleId,
    leftCategory: left,
    rightCategory: right,
    relationship,
    behavior,
    requiredEvidence: extra.requiredEvidence ?? [],
    ...extra,
  });
}

const CATEGORY_RELATIONSHIP_RULES: readonly CategoryRelationshipRule[] = Object.freeze([
  pair(
    'cat.mfg-machine.same-event',
    'MANUFACTURING',
    'AUTOMATED_MACHINE_OUTPUT',
    'SAME_UNDERLYING_EVENT',
    'PRIMARY_AND_LINEAGE',
    { primaryCategory: 'MANUFACTURING' },
  ),
  pair(
    'cat.mfg-goods.identity',
    'MANUFACTURING',
    'GOODS',
    'GOODS_IDENTITY',
    'PRIMARY_AND_LINEAGE',
    { primaryCategory: 'MANUFACTURING' },
  ),
  pair(
    'cat.mfg-goods.same-event',
    'MANUFACTURING',
    'GOODS',
    'SAME_UNDERLYING_EVENT',
    'PRIMARY_AND_LINEAGE',
    { primaryCategory: 'MANUFACTURING' },
  ),
  pair(
    'cat.mfg-logistics.distinct',
    'MANUFACTURING',
    'LOGISTICS_TRANSPORTATION',
    'DISTINCT_REALIZED_SERVICE',
    'SEPARATE_IF_INDEPENDENT',
    { requiredEvidence: ['tonne_km', 'delivery_completion'] },
  ),
  pair(
    'cat.goods-storage.distinct',
    'GOODS',
    'STORAGE',
    'DISTINCT_REALIZED_SERVICE',
    'SEPARATE_IF_INDEPENDENT',
    { requiredEvidence: ['volume_time', 'facility_use', 'realized_service_period'] },
  ),
  pair(
    'cat.mfg-storage.process',
    'MANUFACTURING',
    'STORAGE',
    'LINEAGE_ONLY',
    'LINEAGE_ONLY',
    { primaryCategory: 'MANUFACTURING' },
  ),
  pair(
    'cat.compute-ai.same-event',
    'COMPUTE',
    'AI_COMPUTE',
    'SAME_UNDERLYING_EVENT',
    'PRIMARY_AND_LINEAGE',
    { primaryCategory: 'COMPUTE' },
  ),
  pair(
    'cat.energy-mfg.input',
    'ENERGY',
    'MANUFACTURING',
    'DEPENDENT_INPUT',
    'LINEAGE_ONLY',
    { primaryCategory: 'ENERGY' },
  ),
  pair(
    'cat.energy-machine.input',
    'ENERGY',
    'AUTOMATED_MACHINE_OUTPUT',
    'DEPENDENT_INPUT',
    'LINEAGE_ONLY',
    { primaryCategory: 'ENERGY' },
  ),
]);

const CLAIM_RELATIONSHIP_RULES: readonly ClaimRelationshipRule[] = Object.freeze([
  Object.freeze({
    ruleId: 'claim.capacity-output',
    leftClaimType: 'CAPACITY' satisfies ClaimType,
    rightClaimType: 'OUTPUT' satisfies ClaimType,
    relationship: 'CAPACITY_OF_OUTPUT',
    behavior: 'PRIMARY_AND_LINEAGE',
    primaryClaimType: 'OUTPUT' satisfies ClaimType,
  }),
  Object.freeze({
    ruleId: 'claim.output-delivery',
    leftClaimType: 'OUTPUT' satisfies ClaimType,
    rightClaimType: 'DELIVERY' satisfies ClaimType,
    relationship: 'OUTPUT_OF_DELIVERY',
    behavior: 'PRIMARY_AND_LINEAGE',
    primaryClaimType: 'OUTPUT' satisfies ClaimType,
  }),
  Object.freeze({
    ruleId: 'claim.output-usage',
    leftClaimType: 'OUTPUT' satisfies ClaimType,
    rightClaimType: 'USAGE' satisfies ClaimType,
    relationship: 'LINEAGE_ONLY',
    behavior: 'LINEAGE_ONLY',
    primaryClaimType: 'OUTPUT' satisfies ClaimType,
  }),
]);

export type AttributionPolicyOverrides = {
  readonly policyId?: string;
  readonly version?: number;
  readonly status?: ProductiveAttributionPolicy['status'];
  readonly effectiveHeight?: number;
  readonly defaultDuplicateBehavior?: ProductiveAttributionPolicy['defaultDuplicateBehavior'];
  readonly maximumAggregateShare?: bigint;
  readonly categoryRelationshipRules?: readonly CategoryRelationshipRule[];
  readonly claimRelationshipRules?: readonly ClaimRelationshipRule[];
  readonly reviewThreshold?: number;
};

export function developmentAttributionPolicy(
  overrides: AttributionPolicyOverrides = {},
): ProductiveAttributionPolicy {
  const draft: Omit<ProductiveAttributionPolicy, 'contentHash'> = {
    policyId: overrides.policyId ?? DEVELOPMENT_ATTRIBUTION_POLICY_ID,
    version: overrides.version ?? 1,
    status: overrides.status ?? 'SIMULATION_ACTIVE',
    effectiveHeight: overrides.effectiveHeight ?? 1,
    schemaVersion: ATTRIBUTION_CONSTITUTION_VERSION,
    eventClassRules: EVENT_CLASS_RULES,
    categoryRelationshipRules: overrides.categoryRelationshipRules ?? CATEGORY_RELATIONSHIP_RULES,
    claimRelationshipRules: overrides.claimRelationshipRules ?? CLAIM_RELATIONSHIP_RULES,
    maximumAggregateShare: overrides.maximumAggregateShare ?? ATTRIBUTION_SHARE_SCALE,
    shareScale: ATTRIBUTION_SHARE_SCALE,
    defaultDuplicateBehavior: overrides.defaultDuplicateBehavior ?? 'ZERO_DUPLICATE_ATTRIBUTION',
    reviewThreshold: overrides.reviewThreshold ?? 1,
    requiredEvidenceForSeparateValue: Object.freeze([
      'tonne_km',
      'delivery_completion',
      'volume_time',
      'facility_use',
      'realized_service_period',
    ]),
    requiredEvidenceForSharedValue: Object.freeze([
      'governed_allocation_rule',
      'semantic_measurement_overlap',
    ]),
    governanceReference: 'moonrey-policy-governance',
    parameterClass: ATTRIBUTION_PARAMETER_CLASS,
    productionActivated: false,
    authorizesIssuance: false,
    performsFinalValuation: false,
  };
  return Object.freeze({ ...draft, contentHash: hashAttributionPolicy(draft) });
}

/**
 * v2 simulation split for manufacturing + machine-output on one event.
 * Historical v1 remains PRIMARY_AND_LINEAGE. This is not production policy.
 */
export function splitManufacturingMachinePolicy(effectiveHeight = 100): ProductiveAttributionPolicy {
  const splitRule: CategoryRelationshipRule = Object.freeze({
    ruleId: 'cat.mfg-machine.governed-split',
    leftCategory: 'MANUFACTURING',
    rightCategory: 'AUTOMATED_MACHINE_OUTPUT',
    relationship: 'SAME_UNDERLYING_EVENT',
    behavior: 'GOVERNED_SPLIT',
    primaryCategory: 'MANUFACTURING',
    split: Object.freeze({
      MANUFACTURING: 700_000n,
      AUTOMATED_MACHINE_OUTPUT: 300_000n,
    }),
    requiredEvidence: Object.freeze(['governed_allocation_rule']),
  });
  const rest = developmentAttributionPolicy().categoryRelationshipRules.filter(
    (rule) => rule.ruleId !== 'cat.mfg-machine.same-event',
  );
  return developmentAttributionPolicy({
    version: 2,
    effectiveHeight,
    status: 'SIMULATION_ACTIVE',
    defaultDuplicateBehavior: 'GOVERNED_SPLIT',
    categoryRelationshipRules: Object.freeze([splitRule, ...rest]),
  });
}

export function historicalAttributionPolicy(): ProductiveAttributionPolicy {
  return developmentAttributionPolicy({ version: 1, effectiveHeight: 1 });
}

export function shareScaleMatchesWeightScale(): boolean {
  return ATTRIBUTION_SHARE_SCALE === WEIGHT_SCALE;
}
