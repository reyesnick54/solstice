/**
 * ACCESS Wave 3 — category-scoped fulfillment and entitlement consumption timing.
 */

import type { AccessCategoryId } from '../domain/taxonomy.ts';

export type FulfillmentConsumptionPoint =
  | 'AT_BOOKING_CONFIRMED'
  | 'AT_FULFILLMENT'
  | 'AT_IRREVERSIBLE_ISSUANCE'
  | 'AT_USAGE';

export type AccessFulfillmentPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly category: AccessCategoryId;
  readonly entitlementConsumptionPoint: FulfillmentConsumptionPoint;
  readonly fundingConsumptionPoint: 'AT_CAPTURE' | 'AT_SETTLEMENT';
  readonly supportsNoShow: boolean;
};

const FULFILLMENT_POLICIES: Readonly<Record<AccessCategoryId, AccessFulfillmentPolicy>> = Object.freeze({
  MOBILITY: Object.freeze({
    policyId: 'MOBILITY_FULFILLMENT',
    version: 'v1',
    category: 'MOBILITY',
    entitlementConsumptionPoint: 'AT_FULFILLMENT',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: true,
  }),
  LODGING: Object.freeze({
    policyId: 'LODGING_FULFILLMENT',
    version: 'v1',
    category: 'LODGING',
    entitlementConsumptionPoint: 'AT_FULFILLMENT',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: true,
  }),
  EXPERIENCES: Object.freeze({
    policyId: 'EXPERIENCES_FULFILLMENT',
    version: 'v1',
    category: 'EXPERIENCES',
    entitlementConsumptionPoint: 'AT_IRREVERSIBLE_ISSUANCE',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: true,
  }),
  FOOD: Object.freeze({
    policyId: 'FOOD_FULFILLMENT',
    version: 'v1',
    category: 'FOOD',
    entitlementConsumptionPoint: 'AT_FULFILLMENT',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: false,
  }),
  AI_COMPUTE: Object.freeze({
    policyId: 'AI_COMPUTE_FULFILLMENT',
    version: 'v1',
    category: 'AI_COMPUTE',
    entitlementConsumptionPoint: 'AT_USAGE',
    fundingConsumptionPoint: 'AT_SETTLEMENT',
    supportsNoShow: false,
  }),
  ENERGY: Object.freeze({
    policyId: 'ENERGY_FULFILLMENT',
    version: 'v1',
    category: 'ENERGY',
    entitlementConsumptionPoint: 'AT_USAGE',
    fundingConsumptionPoint: 'AT_SETTLEMENT',
    supportsNoShow: false,
  }),
  TRANSPORTATION: Object.freeze({
    policyId: 'TRANSPORTATION_FULFILLMENT',
    version: 'v1',
    category: 'TRANSPORTATION',
    entitlementConsumptionPoint: 'AT_FULFILLMENT',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: true,
  }),
  ROBOTICS: Object.freeze({
    policyId: 'ROBOTICS_FULFILLMENT',
    version: 'v1',
    category: 'ROBOTICS',
    entitlementConsumptionPoint: 'AT_USAGE',
    fundingConsumptionPoint: 'AT_SETTLEMENT',
    supportsNoShow: false,
  }),
  OTHER: Object.freeze({
    policyId: 'OTHER_FULFILLMENT',
    version: 'v1',
    category: 'OTHER',
    entitlementConsumptionPoint: 'AT_FULFILLMENT',
    fundingConsumptionPoint: 'AT_CAPTURE',
    supportsNoShow: false,
  }),
});

export function resolveFulfillmentPolicy(category: AccessCategoryId): AccessFulfillmentPolicy {
  return FULFILLMENT_POLICIES[category];
}
