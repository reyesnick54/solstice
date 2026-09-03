import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { allocationPolicyIdFor, providerRefFor } from '../ids.ts';
import { freezeAccessGeography } from './geography.ts';
import {
  accessAllocationIdFor,
  accessAllocationSnapshotIdFor,
  accessCapacityIdFor,
  accessDomainEntitlementIdFor,
  accessDomainQuoteIdFor,
  accessDomainRedemptionIdFor,
  accessDomainReservationIdFor,
  accessDomainSettlementIdFor,
  accessDomainTransactionIdFor,
  accessEvidenceRefFor,
  accessFundingPoolIdFor,
  accessProductIdFor,
  accessUserIdFor,
} from './ids.ts';
import { buildAccessCapacity, buildAccessEntitlement, buildAccessSettlement } from './invariants.ts';
import {
  ACCESS_DOMAIN_SCHEMA_VERSION,
  ACCESS_DOMAIN_TAXONOMY_VERSION,
  DEFAULT_CATEGORY_UNITS,
  type AccessCategoryId,
} from './taxonomy.ts';
import type {
  AccessAllocation,
  AccessCategory,
  AccessProduct,
  AccessQuote,
  AccessRedemption,
  AccessReservation,
  AccessTransaction,
} from './types.ts';

export const FIXTURE_NOW = asUtcInstant('2026-08-31T08:00:00.000Z');
export const FIXTURE_UNTIL = asUtcInstant('2026-12-31T23:59:59.000Z');
export const FIXTURE_USER = accessUserIdFor('fixture-user');
export const FIXTURE_PROVIDER = providerRefFor('fixture-provider');
export const FIXTURE_EVIDENCE = accessEvidenceRefFor('fixture-evidence');

export function fixtureAccessCategory(
  id: AccessCategoryId,
  overrides?: Partial<AccessCategory>,
): AccessCategory {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    id,
    name: id.replaceAll('_', ' '),
    description: `Fixture ${id} access category`,
    enabled: true,
    defaultUnit: DEFAULT_CATEGORY_UNITS[id],
    allocationPolicyId: allocationPolicyIdFor(`policy-${id}`),
    fundingPoolId: accessFundingPoolIdFor(`pool-${id}`),
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessProduct(overrides?: Partial<AccessProduct>): AccessProduct {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    accessProductId: accessProductIdFor('standard-mobility-day'),
    category: 'MOBILITY',
    name: 'Standard Mobility Day',
    description: 'One vehicle-day of governed mobility access',
    unit: 'VEHICLE_DAY',
    providerId: null,
    providerProductId: null,
    geography: freezeAccessGeography({
      scope: 'GLOBAL',
      countryCode: null,
      regionRef: null,
      cityRef: null,
      facilityRef: null,
      locationRef: null,
    }),
    termsReference: 'terms://access/mobility/v1',
    enabled: true,
    metadata: Object.freeze({ tier: 'standard' }),
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessCapacity(overrides?: Partial<Parameters<typeof buildAccessCapacity>[0]>) {
  return buildAccessCapacity({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    capacityId: accessCapacityIdFor('fixture-capacity'),
    category: 'MOBILITY',
    accessProductId: accessProductIdFor('standard-mobility-day'),
    providerId: FIXTURE_PROVIDER,
    geography: freezeAccessGeography({
      scope: 'COUNTRY',
      countryCode: asJurisdiction('US'),
      regionRef: null,
      cityRef: null,
      facilityRef: null,
      locationRef: null,
    }),
    periodStart: FIXTURE_NOW,
    periodEnd: FIXTURE_UNTIL,
    totalUnits: 100n,
    reservedUnits: 10n,
    consumedUnits: 5n,
    capacitySource: 'NATIVE_PRODUCTIVE_CAPACITY',
    fundingSource: null,
    status: 'AVAILABLE',
    evidenceReference: FIXTURE_EVIDENCE,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessEntitlement(overrides?: Partial<Parameters<typeof buildAccessEntitlement>[0]>) {
  return buildAccessEntitlement({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    entitlementId: accessDomainEntitlementIdFor('fixture-entitlement'),
    userId: FIXTURE_USER,
    category: 'MOBILITY',
    accessProductId: accessProductIdFor('standard-mobility-day'),
    unit: 'VEHICLE_DAY',
    allocatedUnits: 5n,
    reservedUnits: 1n,
    consumedUnits: 1n,
    effectiveFrom: FIXTURE_NOW,
    expiresAt: FIXTURE_UNTIL,
    allocationSnapshotId: accessAllocationSnapshotIdFor('snapshot-1'),
    status: 'ACTIVE',
    termsVersion: 'access-terms/v1',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessAllocation(overrides?: Partial<AccessAllocation>): AccessAllocation {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    allocationId: accessAllocationIdFor('fixture-allocation'),
    userId: FIXTURE_USER,
    category: 'MOBILITY',
    period: '2026-09',
    capacityId: accessCapacityIdFor('fixture-capacity'),
    allocatedUnits: 5n,
    allocationPolicyId: allocationPolicyIdFor('policy-mobility'),
    allocationPolicyVersion: '1',
    inputSnapshotReference: 'snapshot://allocation/input/v1',
    evidenceReference: FIXTURE_EVIDENCE,
    createdAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessQuote(overrides?: Partial<AccessQuote>): AccessQuote {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    quoteId: accessDomainQuoteIdFor('fixture-quote'),
    userId: FIXTURE_USER,
    providerId: FIXTURE_PROVIDER,
    providerProductId: 'provider-product-1',
    category: 'LODGING',
    requestedUnits: 2n,
    unit: 'ROOM_NIGHT',
    providerPrice: 20_000n,
    currency: 'USD',
    taxes: 1_600n,
    mandatoryFees: 500n,
    optionalFees: 0n,
    securityDeposit: 5_000n,
    totalProviderAmount: 22_100n,
    eligibleAccessAmount: 15_000n,
    userContribution: 7_100n,
    expiresAt: FIXTURE_UNTIL,
    providerQuoteReference: null,
    status: 'ISSUED',
    evidenceReference: FIXTURE_EVIDENCE,
    createdAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessReservation(overrides?: Partial<AccessReservation>): AccessReservation {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    reservationId: accessDomainReservationIdFor('fixture-reservation'),
    userId: FIXTURE_USER,
    quoteId: accessDomainQuoteIdFor('fixture-quote'),
    providerId: FIXTURE_PROVIDER,
    category: 'LODGING',
    requestedUnits: 2n,
    reservedEntitlementUnits: 2n,
    reservedFundingAmount: 7_100n,
    providerReservationReference: null,
    expiresAt: FIXTURE_UNTIL,
    status: 'ENTITLEMENT_RESERVED',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessRedemption(overrides?: Partial<AccessRedemption>): AccessRedemption {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    redemptionId: accessDomainRedemptionIdFor('fixture-redemption'),
    userId: FIXTURE_USER,
    entitlementId: accessDomainEntitlementIdFor('fixture-entitlement'),
    reservationId: accessDomainReservationIdFor('fixture-reservation'),
    category: 'LODGING',
    unit: 'ROOM_NIGHT',
    unitsConsumed: 1n,
    providerId: FIXTURE_PROVIDER,
    providerFulfillmentReference: null,
    fulfilledAt: null,
    status: 'PENDING',
    evidenceReference: FIXTURE_EVIDENCE,
    createdAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessSettlement(
  overrides?: Partial<Parameters<typeof buildAccessSettlement>[0]>,
) {
  return buildAccessSettlement({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    settlementId: accessDomainSettlementIdFor('fixture-settlement'),
    accessTransactionId: accessDomainTransactionIdFor('fixture-transaction'),
    providerId: FIXTURE_PROVIDER,
    currency: 'USD',
    providerAmount: 22_100n,
    accessPoolContribution: 15_000n,
    userFiatContribution: 7_100n,
    taxAmount: 1_600n,
    feeAmount: 500n,
    authorizationReference: null,
    captureReference: null,
    refundReference: null,
    status: 'PENDING',
    evidenceReference: FIXTURE_EVIDENCE,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}

export function fixtureAccessTransaction(overrides?: Partial<AccessTransaction>): AccessTransaction {
  return Object.freeze({
    schemaVersion: ACCESS_DOMAIN_SCHEMA_VERSION,
    taxonomyVersion: ACCESS_DOMAIN_TAXONOMY_VERSION,
    transactionId: accessDomainTransactionIdFor('fixture-transaction'),
    userId: FIXTURE_USER,
    category: 'LODGING',
    productId: accessProductIdFor('hotel-room-night'),
    entitlementId: accessDomainEntitlementIdFor('fixture-entitlement'),
    allocationId: accessAllocationIdFor('fixture-allocation'),
    quoteId: accessDomainQuoteIdFor('fixture-quote'),
    reservationId: accessDomainReservationIdFor('fixture-reservation'),
    redemptionId: null,
    settlementId: null,
    providerId: FIXTURE_PROVIDER,
    status: 'RESERVED',
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...overrides,
  });
}
