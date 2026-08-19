/**
 * Deterministic service-delivery fixtures. Not commercial providers.
 */

import { SERVICE_SCHEMA_IDS } from './schemas.ts';
import type { ServiceContributionLineage, ServiceIdentityBundle, ServiceSourceObservation } from './types.ts';

export const SANDBOX_NOW = 1_700_000_000n;
export const SANDBOX_CONTROLLER = 'controller.services.alpha';
export const SANDBOX_ORG = 'org.services.alpha';

function identity(overrides: Partial<ServiceIdentityBundle> = {}): ServiceIdentityBundle {
  return Object.freeze({
    workOrderRef: 'wo.1001',
    bookingRef: 'book.1001',
    serviceDefinitionRef: 'svc.inspection.v1',
    jobRef: 'job.1001',
    facilityRef: null,
    meterRef: null,
    licenseRef: null,
    humanContributionRef: null,
    automationContributionRef: null,
    ...overrides,
  });
}

function contribution(overrides: Partial<ServiceContributionLineage> = {}): ServiceContributionLineage {
  return Object.freeze({
    humanContributionRef: null,
    automationContributionRef: null,
    issuesSunRey: false,
    issuesMoonRey: false,
    dualCoinAllocatedByGuesswork: false,
    ...overrides,
  });
}

export function serviceObservation(
  overrides: Partial<ServiceSourceObservation> & Pick<ServiceSourceObservation, 'observationId' | 'sourceClass'>,
): ServiceSourceObservation {
  return Object.freeze({
    sourceId: 'src.services.1',
    providerId: 'provider.services.sandbox',
    controllerId: SANDBOX_CONTROLLER,
    upstreamOrganizationId: SANDBOX_ORG,
    sharedControlGroup: null,
    relatedSourceIds: Object.freeze([]),
    factType: 'SERVICE_DELIVERY',
    schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY,
    schemaVersion: 1,
    sourceTimestampUnix: SANDBOX_NOW,
    numericValue: '1',
    unit: 'units_produced',
    serviceKind: 'UNITIZED',
    completionState: 'COMPLETED',
    durationSeconds: null,
    identity: identity(),
    contribution: contribution(),
    invoicePresent: false,
    paymentPresent: false,
    invoiceAmountMinorUnits: null,
    historicalMachineHourRecord: false,
    cancelled: false,
    cancelledAfterRealization: false,
    ...overrides,
  });
}

export const VALID_UNITIZED_SERVICE = serviceObservation({
  observationId: 'obs.svc.unitized.valid',
  sourceClass: 'MAINTENANCE_COMPLETION_SYSTEM',
  serviceKind: 'UNITIZED',
  completionState: 'COMPLETED',
  numericValue: '1',
  unit: 'units_produced',
  identity: identity({ serviceDefinitionRef: 'svc.maintenance.op.v1' }),
});

export const VALID_TIME_SERVICE = serviceObservation({
  observationId: 'obs.svc.time.valid',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR,
  serviceKind: 'TIME_BASED',
  completionState: 'ACCEPTED',
  numericValue: '3',
  unit: 'service_hour',
  durationSeconds: 10_800n,
});

export const HISTORICAL_MACHINE_HOUR = serviceObservation({
  observationId: 'obs.svc.machine-h.historical',
  sourceClass: 'FACILITY_SERVICE_SYSTEM',
  serviceKind: 'TIME_BASED',
  completionState: 'COMPLETED',
  numericValue: '2',
  unit: 'machine_h',
  durationSeconds: 7_200n,
  historicalMachineHourRecord: true,
});

export const DIGITAL_SERVICE_METER = serviceObservation({
  observationId: 'obs.svc.digital.valid',
  sourceClass: 'API_SERVICE_METER',
  serviceKind: 'DIGITAL_METER',
  completionState: 'COMPLETED',
  numericValue: '12',
  unit: 'units_produced',
  identity: identity({
    serviceDefinitionRef: 'svc.api.job.v1',
    jobRef: 'job.api.12',
    meterRef: 'meter.api.1',
  }),
});

export const BOOKING_AS_COMPLETION = serviceObservation({
  observationId: 'obs.svc.booking',
  sourceClass: 'BOOKING_COMPLETION_SYSTEM',
  completionState: 'BOOKED',
});

export const INVOICE_AS_COMPLETION = serviceObservation({
  observationId: 'obs.svc.invoice',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  completionState: 'INVOICED',
  invoicePresent: true,
  invoiceAmountMinorUnits: 15_000n,
  unit: 'service_hour',
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR,
  serviceKind: 'TIME_BASED',
  durationSeconds: null,
});

export const PAYMENT_AS_OUTPUT = serviceObservation({
  observationId: 'obs.svc.payment',
  sourceClass: 'SERVICE_ORDER_SYSTEM',
  completionState: 'IN_PROGRESS',
  paymentPresent: true,
});

export const MACHINE_H_AS_HUMAN_HOUR = serviceObservation({
  observationId: 'obs.svc.machine-h.misuse',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  serviceKind: 'TIME_BASED',
  completionState: 'COMPLETED',
  numericValue: '3',
  unit: 'machine_h',
  durationSeconds: 10_800n,
  historicalMachineHourRecord: false,
});

export const HOURS_FROM_INVOICE = serviceObservation({
  observationId: 'obs.svc.hours-from-invoice',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR,
  serviceKind: 'TIME_BASED',
  completionState: 'COMPLETED',
  numericValue: '4',
  unit: 'service_hour',
  durationSeconds: null,
  invoicePresent: true,
  invoiceAmountMinorUnits: 40_000n,
});

export const DIGITAL_PAYLOAD_LEAK = serviceObservation({
  observationId: 'obs.svc.payload',
  sourceClass: 'DIGITAL_SERVICE_METER',
  serviceKind: 'DIGITAL_METER',
  completionState: 'COMPLETED',
  payloadBody: '{"prompt":"summarize the customer contract"}',
  identity: identity({ serviceDefinitionRef: 'svc.api.job.v1' }),
});

export const CUSTOMER_PII_LEAK = serviceObservation({
  observationId: 'obs.svc.pii',
  sourceClass: 'FIELD_SERVICE_MANAGEMENT',
  completionState: 'COMPLETED',
  rawCustomerName: 'Grace Hopper',
  rawEmail: 'grace@example.test',
  rawPhone: '+15555550100',
});

export const HUMAN_WORTH_SCORE = serviceObservation({
  observationId: 'obs.svc.worth',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR,
  serviceKind: 'TIME_BASED',
  completionState: 'COMPLETED',
  unit: 'service_hour',
  durationSeconds: 3_600n,
  humanWorthScore: '0.92',
});

export const SAME_CONTROLLER_QUORUM = serviceObservation({
  observationId: 'obs.svc.same-controller',
  sourceClass: 'WORK_ORDER_SYSTEM',
  completionState: 'COMPLETED',
  sharedControlGroup: 'services.alpha.apis',
  relatedSourceIds: Object.freeze(['src.services.1', 'src.services.billing']),
});

export const FLOAT_DURATION = serviceObservation({
  observationId: 'obs.svc.float',
  sourceClass: 'PROFESSIONAL_SERVICE_SYSTEM',
  schemaId: SERVICE_SCHEMA_IDS.SERVICE_DELIVERY_SERVICE_HOUR,
  serviceKind: 'TIME_BASED',
  completionState: 'COMPLETED',
  numericValue: '1.5',
  unit: 'service_hour',
  durationSeconds: 5_400n,
});

export const SCHEMA_DRIFT = serviceObservation({
  observationId: 'obs.svc.drift',
  sourceClass: 'WORK_ORDER_SYSTEM',
  completionState: 'COMPLETED',
  schemaId: 'service.delivery.v1.changed',
  schemaVersion: 2,
});

export const CANCELLED_BOOKING = serviceObservation({
  observationId: 'obs.svc.cancelled',
  sourceClass: 'BOOKING_COMPLETION_SYSTEM',
  completionState: 'BOOKED',
  cancelled: true,
  cancelledAfterRealization: false,
});
