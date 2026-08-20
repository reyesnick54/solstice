/**
 * Governed Productive Value Function factor taxonomy.
 *
 * Factors are versioned, bounded, and category-eligible. Opaque AI,
 * model-opinion, and provider-self-reported value factors are forbidden.
 */

import { CLAIM_TYPES, PRODUCTIVE_CATEGORIES, type ClaimType, type ProductiveCategory } from '../../types.ts';
import {
  ATTRIBUTION_SHARE_SCALE,
  REALIZATION_STATES,
  RESERVED_VALUE_FACTOR_TYPES,
  VALUE_FACTOR_SCALE,
  VALUE_FACTOR_TYPES,
  type CategoryFactorEligibility,
  type CategoryFactorRule,
  type PerCategoryValueRule,
  type RealizationState,
  type ReservedValueFactorDefinition,
  type ValueFactorDefinition,
  type ValueFactorType,
} from './types.ts';

export const DEVELOPMENT_FACTOR_VERSION = 1 as const;
export const DEVELOPMENT_GOVERNANCE_REFERENCE = 'chunk-123.simulation.factor-taxonomy.v1' as const;

const COMMON_REQUIRED: readonly ValueFactorType[] = [
  'ATTRIBUTION_SHARE_FACTOR',
  'REALIZATION_FACTOR',
  'VERIFICATION_QUALITY_FACTOR',
];

function definition(
  factorType: ValueFactorType,
  overrides: Partial<ValueFactorDefinition> & Pick<
    ValueFactorDefinition,
    'inputSourceType' | 'transformationMethod' | 'missingInputBehavior' | 'evidenceRequirements'
  >,
): ValueFactorDefinition {
  return Object.freeze({
    factorId: `moonrey.value.${factorType}.v${DEVELOPMENT_FACTOR_VERSION}`,
    factorVersion: DEVELOPMENT_FACTOR_VERSION,
    factorType,
    requiredReferenceFactTypes: overrides.requiredReferenceFactTypes ?? [],
    minimum: overrides.minimum ?? 0n,
    maximum: overrides.maximum ?? VALUE_FACTOR_SCALE,
    neutralValue: overrides.neutralValue ?? VALUE_FACTOR_SCALE,
    roundingRule: overrides.roundingRule ?? 'FLOOR',
    governanceReference: overrides.governanceReference ?? DEVELOPMENT_GOVERNANCE_REFERENCE,
    enabled: overrides.enabled ?? true,
    inputSourceType: overrides.inputSourceType,
    transformationMethod: overrides.transformationMethod,
    missingInputBehavior: overrides.missingInputBehavior,
    evidenceRequirements: overrides.evidenceRequirements,
  });
}

export const DEVELOPMENT_FACTOR_DEFINITIONS: readonly ValueFactorDefinition[] = Object.freeze([
  definition('REALIZATION_FACTOR', {
    inputSourceType: 'CLAIM_AND_REALIZATION_STATE',
    transformationMethod: 'REALIZATION_STATE_GATE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['realization_state', 'verified_contribution'],
    minimum: 0n,
    maximum: VALUE_FACTOR_SCALE,
    neutralValue: 0n,
  }),
  definition('CLAIM_STATE_FACTOR', {
    inputSourceType: 'CLAIM_AND_REALIZATION_STATE',
    transformationMethod: 'CLAIM_STATE_GATE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['claim_output_state', 'verified_contribution'],
  }),
  definition('VERIFICATION_QUALITY_FACTOR', {
    inputSourceType: 'ORACLE_QUALITY_PROVENANCE',
    transformationMethod: 'QUALITY_CLASS_TO_BOUNDED_FACTOR',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['canonical_oracle_quality'],
    requiredReferenceFactTypes: ['QUALITY'],
    minimum: 0n,
    maximum: VALUE_FACTOR_SCALE,
  }),
  definition('FRESHNESS_FACTOR', {
    inputSourceType: 'ORACLE_QUALITY_PROVENANCE',
    transformationMethod: 'AGE_TO_FRESHNESS_FACTOR',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['fact_age', 'policy_maximum_age'],
    requiredReferenceFactTypes: ['FRESHNESS'],
    minimum: 0n,
    maximum: VALUE_FACTOR_SCALE,
  }),
  definition('SOURCE_INDEPENDENCE_FACTOR', {
    inputSourceType: 'ORACLE_QUALITY_PROVENANCE',
    transformationMethod: 'PROVENANCE_INDEPENDENCE_SCHEDULE',
    missingInputBehavior: 'REVIEW_REQUIRED',
    evidenceRequirements: ['independent_source_quorum'],
  }),
  definition('UTILIZATION_FACTOR', {
    inputSourceType: 'GOVERNED_CAPACITY_BASIS',
    transformationMethod: 'RATIO_ACTUAL_OVER_GOVERNED_BASIS',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['actual_output_or_usage', 'verified_available_capacity'],
    requiredReferenceFactTypes: ['UTILIZATION', 'CAPACITY', 'AVAILABILITY'],
    minimum: 0n,
    maximum: VALUE_FACTOR_SCALE,
    neutralValue: 0n,
  }),
  definition('SCARCITY_FACTOR', {
    inputSourceType: 'VERIFIED_REFERENCE_FACT',
    transformationMethod: 'SCARCITY_FROM_VERIFIED_REFERENCE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: [
      'verified_available_supply_or_capacity',
      'approved_regional_demand_or_institutional_reference',
    ],
    requiredReferenceFactTypes: ['REGIONAL_SUPPLY', 'REGIONAL_DEMAND_PROXY', 'CAPACITY', 'AVAILABILITY'],
    minimum: 500_000n,
    maximum: 1_500_000n,
    neutralValue: VALUE_FACTOR_SCALE,
  }),
  definition('DELIVERY_FACTOR', {
    inputSourceType: 'CLAIM_AND_REALIZATION_STATE',
    transformationMethod: 'DELIVERY_STATE_GATE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['verified_delivery_or_completed_service'],
    requiredReferenceFactTypes: ['DELIVERY_STATE'],
  }),
  definition('GEOGRAPHIC_CONTEXT_FACTOR', {
    inputSourceType: 'VERIFIED_REFERENCE_FACT',
    transformationMethod: 'GEOGRAPHY_FROM_VERSIONED_REFERENCE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['versioned_geographic_reference', 'jurisdiction_policy'],
    requiredReferenceFactTypes: ['REGIONAL_SUPPLY', 'REGIONAL_DEMAND_PROXY'],
    minimum: 500_000n,
    maximum: 1_250_000n,
    neutralValue: VALUE_FACTOR_SCALE,
  }),
  definition('ECONOMIC_CATEGORY_FACTOR', {
    inputSourceType: 'VERIFIED_CONTRIBUTION',
    transformationMethod: 'CATEGORY_SCHEDULE',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['category_policy_schedule'],
    minimum: 250_000n,
    maximum: VALUE_FACTOR_SCALE,
  }),
  definition('PROVENANCE_CONFIDENCE_FACTOR', {
    inputSourceType: 'ORACLE_QUALITY_PROVENANCE',
    transformationMethod: 'PROVENANCE_INDEPENDENCE_SCHEDULE',
    missingInputBehavior: 'REVIEW_REQUIRED',
    evidenceRequirements: ['source_quorum', 'lineage_completeness'],
  }),
  definition('ATTRIBUTION_SHARE_FACTOR', {
    inputSourceType: 'ATTRIBUTION_DECISION',
    transformationMethod: 'ATTRIBUTION_SHARE_EXACT_RATIONAL',
    missingInputBehavior: 'FAIL_CLOSED',
    evidenceRequirements: ['chunk_121_122_attribution_decision'],
    minimum: 0n,
    maximum: ATTRIBUTION_SHARE_SCALE,
    neutralValue: 0n,
  }),
  definition('CONCENTRATION_RISK_FACTOR', {
    inputSourceType: 'GOVERNED_CONCENTRATION_CONTEXT',
    transformationMethod: 'CONCENTRATION_REVIEW_OR_BOUNDED',
    missingInputBehavior: 'GOVERNED_NEUTRAL_ALLOWED',
    evidenceRequirements: ['provider_controller_object_concentration_context'],
    minimum: 250_000n,
    maximum: VALUE_FACTOR_SCALE,
    neutralValue: VALUE_FACTOR_SCALE,
  }),
]);

export const RESERVED_FACTOR_DEFINITIONS: readonly ReservedValueFactorDefinition[] = Object.freeze(
  RESERVED_VALUE_FACTOR_TYPES.map((factorType) =>
    Object.freeze({
      factorType,
      enabled: false as const,
      reserved: true as const,
      reason: 'Reserved future factor class. Disabled until a later governed policy version.',
    }),
  ),
);

export const CANONICAL_FACTOR_ORDER: readonly ValueFactorType[] = Object.freeze([
  'REALIZATION_FACTOR',
  'CLAIM_STATE_FACTOR',
  'VERIFICATION_QUALITY_FACTOR',
  'FRESHNESS_FACTOR',
  'SOURCE_INDEPENDENCE_FACTOR',
  'PROVENANCE_CONFIDENCE_FACTOR',
  'UTILIZATION_FACTOR',
  'SCARCITY_FACTOR',
  'GEOGRAPHIC_CONTEXT_FACTOR',
  'DELIVERY_FACTOR',
  'ECONOMIC_CATEGORY_FACTOR',
  'CONCENTRATION_RISK_FACTOR',
  'ATTRIBUTION_SHARE_FACTOR',
]);

type CategoryPlan = {
  readonly eligible: readonly ValueFactorType[];
  readonly required: readonly ValueFactorType[];
  readonly disabled: readonly ValueFactorType[];
  readonly references: PerCategoryValueRule['requiredReferenceFactTypes'];
  readonly claims: readonly ClaimType[];
  readonly realization: readonly RealizationState[];
  readonly notes: Readonly<Partial<Record<ValueFactorType, string>>>;
};

const OUTPUT_CLAIMS: readonly ClaimType[] = ['OUTPUT', 'USAGE'];
const OUTPUT_DELIVERY_CLAIMS: readonly ClaimType[] = ['OUTPUT', 'USAGE', 'DELIVERY'];
const REALIZED: readonly RealizationState[] = ['ACTUAL_OUTPUT', 'VERIFIED_DELIVERY', 'COMPLETED_ECONOMIC_SERVICE'];
const SERVICE_REALIZED: readonly RealizationState[] = ['COMPLETED_ECONOMIC_SERVICE', 'VERIFIED_DELIVERY'];

function complement(eligible: readonly ValueFactorType[]): readonly ValueFactorType[] {
  return VALUE_FACTOR_TYPES.filter((factor) => !eligible.includes(factor));
}

const CATEGORY_PLANS: Readonly<Record<ProductiveCategory, CategoryPlan>> = {
  ENERGY: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
      'UTILIZATION_FACTOR',
      'SCARCITY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'DELIVERY_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'FRESHNESS_FACTOR'],
    disabled: [],
    references: ['UTILIZATION', 'CAPACITY', 'REGIONAL_SUPPLY', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Actual output over governed available capacity when independently evidenced.',
      SCARCITY_FACTOR: 'Grid-region scarcity from verified reference facts only.',
      GEOGRAPHIC_CONTEXT_FACTOR: 'Jurisdiction-aware grid-region context, not a country-preference multiplier.',
    },
  },
  AI_COMPUTE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'PROVENANCE_CONFIDENCE_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ]),
    references: ['UTILIZATION', 'CAPACITY', 'AVAILABILITY', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Used compute over verified available capacity. Provider self-report is insufficient.',
      SCARCITY_FACTOR: 'Disabled. Compute scarcity is not inferred from price or sentiment.',
      GEOGRAPHIC_CONTEXT_FACTOR: 'Disabled. No arbitrary regional compute-preference multiplier.',
      DELIVERY_FACTOR: 'Disabled. Realized compute is the output state; delivery is not a second event.',
    },
  },
  MANUFACTURING: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'DELIVERY_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['DELIVERY_STATE', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_DELIVERY_CLAIMS,
    realization: REALIZED,
    notes: {
      DELIVERY_FACTOR: 'Distinguishes verified output from delivered output. Attribution prevents double counting.',
      UTILIZATION_FACTOR: 'Disabled. Installed factory capacity is not realized output.',
      SCARCITY_FACTOR: 'Disabled until a later governed industrial-reference policy.',
    },
  },
  LOGISTICS_TRANSPORTATION: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'DELIVERY_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['DELIVERY_STATE', 'QUALITY', 'FRESHNESS', 'REGIONAL_DEMAND_PROXY'],
    claims: ['DELIVERY', 'OUTPUT', 'USAGE'],
    realization: ['VERIFIED_DELIVERY', 'COMPLETED_ECONOMIC_SERVICE', 'ACTUAL_OUTPUT'],
    notes: {
      DELIVERY_FACTOR: 'Verified delivery is primary. Tonne-km arrives via the normalization receipt, not a second unit.',
      GEOGRAPHIC_CONTEXT_FACTOR: 'Corridor congestion requires a versioned geographic reference.',
      UTILIZATION_FACTOR: 'Disabled. Fleet capacity alone is not delivered work.',
    },
  },
  WATER: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'SCARCITY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'SCARCITY_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'SCARCITY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['AVAILABILITY', 'REGIONAL_SUPPLY', 'QUALITY', 'FRESHNESS', 'CAPACITY'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      SCARCITY_FACTOR: 'Basin availability from verified reference facts. Price alone cannot define scarcity.',
      GEOGRAPHIC_CONTEXT_FACTOR: 'Water-basin geography, jurisdiction-aware and versioned.',
      DELIVERY_FACTOR: 'Disabled. Verified output/availability is the realization path.',
    },
  },
  SERVICES: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['QUALITY', 'FRESHNESS', 'DELIVERY_STATE'],
    claims: ['USAGE', 'OUTPUT'],
    realization: SERVICE_REALIZED,
    notes: {
      REALIZATION_FACTOR: 'Completed economic service only. Capacity and reservation do not value.',
      UTILIZATION_FACTOR: 'Disabled. Service hours are not occupancy of a capacity basis.',
      SCARCITY_FACTOR: 'Disabled. Service scarcity is not inferred from price.',
    },
  },
  FOOD_AGRICULTURE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['DELIVERY_STATE', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_DELIVERY_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Disabled. Planted area is not harvested output.',
      SCARCITY_FACTOR: 'Disabled pending a later agricultural-reference policy.',
    },
  },
  MINERALS_RAW_MATERIALS: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'SCARCITY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'SCARCITY_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['REGIONAL_SUPPLY', 'CAPACITY', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      SCARCITY_FACTOR: 'Reserve/capacity references cannot mint. Extraction output is the realization path.',
      UTILIZATION_FACTOR: 'Disabled. Reserve utilization is not extracted output.',
    },
  },
  REAL_ESTATE_USE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'UTILIZATION_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'GEOGRAPHIC_CONTEXT_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ]),
    references: ['UTILIZATION', 'AVAILABILITY', 'QUALITY', 'FRESHNESS'],
    claims: ['USAGE'],
    realization: ['COMPLETED_ECONOMIC_SERVICE', 'ACTUAL_OUTPUT'],
    notes: {
      UTILIZATION_FACTOR: 'Occupied use over verified available space. Installed floor area is not realized use.',
      SCARCITY_FACTOR: 'Disabled. Location rent is not automatic productive value.',
    },
  },
  COMPUTE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['UTILIZATION', 'CAPACITY', 'AVAILABILITY', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Used compute over verified available capacity.',
      SCARCITY_FACTOR: 'Disabled. Hardware list price is not scarcity.',
    },
  },
  STORAGE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ],
    required: [...COMMON_REQUIRED, 'UTILIZATION_FACTOR'],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ]),
    references: ['UTILIZATION', 'AVAILABILITY', 'CAPACITY', 'QUALITY'],
    claims: ['USAGE'],
    realization: ['ACTUAL_OUTPUT', 'COMPLETED_ECONOMIC_SERVICE'],
    notes: {
      UTILIZATION_FACTOR: 'Occupied storage over verified available storage.',
      SCARCITY_FACTOR: 'Disabled. Empty warehouse capacity is not realized output.',
    },
  },
  BANDWIDTH_COMMUNICATIONS: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ]),
    references: ['UTILIZATION', 'CAPACITY', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Used bandwidth over verified available capacity.',
      GEOGRAPHIC_CONTEXT_FACTOR: 'Disabled. No country-preference transit multiplier.',
    },
  },
  INFRASTRUCTURE: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
    ]),
    references: ['DELIVERY_STATE', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_DELIVERY_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Reserved conceptually as disabled. Installed infrastructure is not realized service.',
      SCARCITY_FACTOR: 'Disabled. Construction cost is not productive scarcity.',
    },
  },
  GOODS: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['DELIVERY_STATE', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_DELIVERY_CLAIMS,
    realization: REALIZED,
    notes: {
      DELIVERY_FACTOR: 'Goods output and delivery remain one attributed event family.',
      UTILIZATION_FACTOR: 'Disabled. Inventory capacity is not sold or delivered goods.',
    },
  },
  AUTOMATED_MACHINE_OUTPUT: {
    eligible: [
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ],
    required: [...COMMON_REQUIRED],
    disabled: complement([
      'REALIZATION_FACTOR',
      'CLAIM_STATE_FACTOR',
      'VERIFICATION_QUALITY_FACTOR',
      'FRESHNESS_FACTOR',
      'UTILIZATION_FACTOR',
      'DELIVERY_FACTOR',
      'ECONOMIC_CATEGORY_FACTOR',
      'PROVENANCE_CONFIDENCE_FACTOR',
      'ATTRIBUTION_SHARE_FACTOR',
      'CONCENTRATION_RISK_FACTOR',
      'SOURCE_INDEPENDENCE_FACTOR',
    ]),
    references: ['UTILIZATION', 'CAPACITY', 'DELIVERY_STATE', 'QUALITY', 'FRESHNESS'],
    claims: OUTPUT_DELIVERY_CLAIMS,
    realization: REALIZED,
    notes: {
      UTILIZATION_FACTOR: 'Machine output over verified available machine time.',
      SCARCITY_FACTOR: 'Disabled. Robot count is not scarcity.',
    },
  },
} as const satisfies Readonly<Record<ProductiveCategory, CategoryPlan>>;

export function categoryPlan(category: ProductiveCategory): CategoryPlan {
  return CATEGORY_PLANS[category];
}

export function developmentCategoryRules(): readonly PerCategoryValueRule[] {
  return Object.freeze(
    PRODUCTIVE_CATEGORIES.map((category) => {
      const plan = CATEGORY_PLANS[category];
      return Object.freeze({
        category,
        eligibleFactorTypes: plan.eligible,
        requiredFactorTypes: plan.required,
        disabledFactorTypes: plan.disabled,
        requiredReferenceFactTypes: plan.references,
        eligibleClaimTypes: plan.claims,
        eligibleRealizationStates: plan.realization,
      });
    }),
  );
}

export function categoryFactorRules(): readonly CategoryFactorRule[] {
  const rules: CategoryFactorRule[] = [];
  for (const category of PRODUCTIVE_CATEGORIES) {
    const plan = CATEGORY_PLANS[category];
    for (const factorType of VALUE_FACTOR_TYPES) {
      const eligibility: CategoryFactorEligibility = plan.required.includes(factorType)
        ? 'REQUIRED'
        : plan.eligible.includes(factorType)
          ? 'ELIGIBLE'
          : 'DISABLED';
      rules.push(
        Object.freeze({
          category,
          factorType,
          eligibility,
          reason: plan.notes[factorType] ?? `${eligibility} under Chunk 123 ${category} factor policy.`,
        }),
      );
    }
  }
  return Object.freeze(rules);
}

export function factorDefinition(factorType: ValueFactorType): ValueFactorDefinition {
  const found = DEVELOPMENT_FACTOR_DEFINITIONS.find((item) => item.factorType === factorType);
  if (!found) {
    throw new TypeError(`missing factor definition for ${factorType}`);
  }
  return found;
}

export function factorEligibleForCategory(category: ProductiveCategory, factorType: ValueFactorType): boolean {
  return CATEGORY_PLANS[category].eligible.includes(factorType);
}

export function everyCategoryHasDeliberateFactorPolicy(): boolean {
  return PRODUCTIVE_CATEGORIES.every((category) => {
    const plan = CATEGORY_PLANS[category];
    const covered = new Set([...plan.eligible, ...plan.disabled]);
    return (
      plan.required.every((factor) => plan.eligible.includes(factor)) &&
      VALUE_FACTOR_TYPES.every((factor) => covered.has(factor)) &&
      plan.required.includes('ATTRIBUTION_SHARE_FACTOR') &&
      plan.claims.every((claim) => (CLAIM_TYPES as readonly string[]).includes(claim)) &&
      plan.realization.every((state) => (REALIZATION_STATES as readonly string[]).includes(state))
    );
  });
}
