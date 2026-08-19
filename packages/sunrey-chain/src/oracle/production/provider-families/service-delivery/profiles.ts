/**
 * Provider-neutral service source-class profiles. Named vendors are
 * not connected. Source classes do not share one physical measurement.
 */

import type { ServiceKind, ServiceSourceClass } from './types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';

export type ServiceSourceProfile = {
  readonly sourceClass: ServiceSourceClass;
  readonly factType: 'SERVICE_DELIVERY';
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly defaultKind: ServiceKind;
  readonly defaultUnit: 'units_produced' | 'service_hour';
  readonly namedVendorRequired: false;
};

export const SERVICE_SOURCE_PROFILES: Readonly<Record<ServiceSourceClass, ServiceSourceProfile>> = Object.freeze({
  FIELD_SERVICE_MANAGEMENT: Object.freeze({
    sourceClass: 'FIELD_SERVICE_MANAGEMENT',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  SERVICE_ORDER_SYSTEM: Object.freeze({
    sourceClass: 'SERVICE_ORDER_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  PROFESSIONAL_SERVICE_SYSTEM: Object.freeze({
    sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'TIME_BASED',
    defaultUnit: 'service_hour',
    namedVendorRequired: false,
  }),
  MAINTENANCE_COMPLETION_SYSTEM: Object.freeze({
    sourceClass: 'MAINTENANCE_COMPLETION_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  DIGITAL_SERVICE_METER: Object.freeze({
    sourceClass: 'DIGITAL_SERVICE_METER',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'DIGITAL_METER',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  API_SERVICE_METER: Object.freeze({
    sourceClass: 'API_SERVICE_METER',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'DIGITAL_METER',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  FACILITY_SERVICE_SYSTEM: Object.freeze({
    sourceClass: 'FACILITY_SERVICE_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'TIME_BASED',
    defaultUnit: 'service_hour',
    namedVendorRequired: false,
  }),
  BOOKING_COMPLETION_SYSTEM: Object.freeze({
    sourceClass: 'BOOKING_COMPLETION_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  WORK_ORDER_SYSTEM: Object.freeze({
    sourceClass: 'WORK_ORDER_SYSTEM',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
  INDEPENDENT_SERVICE_ATTESTATION: Object.freeze({
    sourceClass: 'INDEPENDENT_SERVICE_ATTESTATION',
    factType: 'SERVICE_DELIVERY',
    productiveCategory: 'SERVICES',
    claimType: 'DELIVERY',
    defaultKind: 'UNITIZED',
    defaultUnit: 'units_produced',
    namedVendorRequired: false,
  }),
});

export function profileFor(sourceClass: ServiceSourceClass): ServiceSourceProfile {
  return SERVICE_SOURCE_PROFILES[sourceClass];
}

export function namedVendorConnected(): false {
  return false;
}
