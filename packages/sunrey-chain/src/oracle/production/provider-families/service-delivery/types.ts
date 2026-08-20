/**
 * Chunk 137 — Service-delivery economic data fabric types.
 *
 * Provider-neutral evidence for service completion, unitized services,
 * and time-based services. Extends the existing production-oracle owner.
 * Does not value a person's worth, mint MoonRey, or treat invoices,
 * bookings, or payments as completed service.
 *
 * Historical SERVICE_DELIVERY records that used machine_h remain valid
 * as historical machine-time evidence. New time-based human/service
 * work uses service_hour.
 */

import type { FactType } from '../../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';

export const SERVICES_FABRIC_ID = 'sunrey.services-data-fabric.v1' as const;
export const SERVICES_FABRIC_SCHEMA_VERSION = 1 as const;
export const SERVICE_HOUR_SCHEMA_EXTENSION = 'service.delivery.v1.service_hour' as const;

export const PRODUCTION_ACTIVE = false as const;
export const REAL_PROVIDER_CONTACTED = false as const;
export const SERVICE_FACT_AUTO_MINTS = false as const;
export const INVOICE_EQUALS_COMPLETED_SERVICE = false as const;
export const BOOKING_EQUALS_COMPLETED_SERVICE = false as const;
export const PAYMENT_EQUALS_PRODUCTIVE_OUTPUT = false as const;
export const HUMAN_WORTH_SCORING = false as const;
export const FLOAT_MATH_USED = false as const;
export const SERVICE_VALUE_FROM_INVOICE = false as const;

export const SERVICE_SOURCE_CLASSES = [
  'FIELD_SERVICE_MANAGEMENT',
  'SERVICE_ORDER_SYSTEM',
  'PROFESSIONAL_SERVICE_SYSTEM',
  'MAINTENANCE_COMPLETION_SYSTEM',
  'DIGITAL_SERVICE_METER',
  'API_SERVICE_METER',
  'FACILITY_SERVICE_SYSTEM',
  'BOOKING_COMPLETION_SYSTEM',
  'WORK_ORDER_SYSTEM',
  'INDEPENDENT_SERVICE_ATTESTATION',
] as const;
export type ServiceSourceClass = (typeof SERVICE_SOURCE_CLASSES)[number];

export const SERVICE_FACT_TYPES = ['SERVICE_DELIVERY'] as const satisfies readonly FactType[];
export type ServiceFactType = (typeof SERVICE_FACT_TYPES)[number];

export const FORBIDDEN_SERVICE_FACT_TYPES = ['REVENUE', 'SALES_VALUE', 'INVOICE_VALUE'] as const;
export type ForbiddenServiceFactType = (typeof FORBIDDEN_SERVICE_FACT_TYPES)[number];

export const SERVICE_KINDS = ['UNITIZED', 'TIME_BASED', 'DIGITAL_METER', 'MIXED_HUMAN_AUTOMATION'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_COMPLETION_STATES = [
  'BOOKED',
  'SCHEDULED',
  'IN_PROGRESS',
  'INVOICED',
  'COMPLETED',
  'ACCEPTED',
  'CANCELLED',
] as const;
export type ServiceCompletionState = (typeof SERVICE_COMPLETION_STATES)[number];

export const SERVICE_COMPLETED_STATES = ['COMPLETED', 'ACCEPTED'] as const;
export type ServiceCompletedState = (typeof SERVICE_COMPLETED_STATES)[number];

export const SERVICE_UNITS = ['units_produced', 'UNIT', 'service_hour', 'machine_h'] as const;
export type ServiceUnit = (typeof SERVICE_UNITS)[number];

export const SERVICE_REFUSAL_CODES = [
  'BOOKING_IS_NOT_COMPLETION',
  'INVOICE_IS_NOT_COMPLETION',
  'PAYMENT_IS_NOT_OUTPUT',
  'SERVICE_NOT_COMPLETED',
  'CANCELLED_BEFORE_REALIZATION',
  'DURATION_REQUIRED',
  'HOURS_INFERRED_FROM_INVOICE',
  'MACHINE_H_IS_NOT_SERVICE_HOUR',
  'FLOAT_QUANTITY_FORBIDDEN',
  'SCHEMA_DRIFT',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'CUSTOMER_PII_FORBIDDEN',
  'PAYLOAD_FORBIDDEN',
  'PAYMENT_CREDENTIAL_FORBIDDEN',
  'HUMAN_WORTH_SCORING_FORBIDDEN',
  'FORBIDDEN_FACT_TYPE',
  'UNKNOWN_SOURCE_CLASS',
  'UNKNOWN_FACT_TYPE',
  'NETWORK_FORBIDDEN',
  'AUTO_MINT_FORBIDDEN',
  'WRONG_UNIT',
  'DUAL_COIN_GUESSWORK_FORBIDDEN',
  'UNITIZED_EQUIVALENCE_FORBIDDEN',
] as const;
export type ServiceRefusalCode = (typeof SERVICE_REFUSAL_CODES)[number];

export type ServiceRefusal = {
  readonly code: ServiceRefusalCode;
  readonly detail: string;
};

export type ServiceIdentityBundle = {
  readonly workOrderRef: string | null;
  readonly bookingRef: string | null;
  readonly serviceDefinitionRef: string | null;
  readonly jobRef: string | null;
  readonly facilityRef: string | null;
  readonly meterRef: string | null;
  readonly licenseRef: string | null;
  readonly humanContributionRef: string | null;
  readonly automationContributionRef: string | null;
};

export type ServiceContributionLineage = {
  readonly humanContributionRef: string | null;
  readonly automationContributionRef: string | null;
  readonly issuesSunRey: false;
  readonly issuesMoonRey: false;
  readonly dualCoinAllocatedByGuesswork: false;
};

export type ServiceSourceObservation = {
  readonly observationId: string;
  readonly sourceClass: ServiceSourceClass;
  readonly sourceId: string;
  readonly providerId: string;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly relatedSourceIds: readonly string[];
  readonly factType: FactType | ForbiddenServiceFactType;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly sourceTimestampUnix: bigint;
  readonly numericValue: string;
  readonly unit: string;
  readonly serviceKind: ServiceKind;
  readonly completionState: ServiceCompletionState;
  readonly durationSeconds: bigint | null;
  readonly identity: ServiceIdentityBundle;
  readonly contribution: ServiceContributionLineage;
  readonly invoicePresent: boolean;
  readonly paymentPresent: boolean;
  readonly invoiceAmountMinorUnits: bigint | null;
  readonly historicalMachineHourRecord: boolean;
  readonly cancelled: boolean;
  readonly cancelledAfterRealization: boolean;
  readonly extras?: Readonly<Record<string, unknown>> | undefined;
  readonly promptContent?: string | undefined;
  readonly payloadBody?: string | undefined;
  readonly customerContent?: string | undefined;
  readonly supportChatContent?: string | undefined;
  readonly rawCustomerName?: string | undefined;
  readonly rawEmail?: string | undefined;
  readonly rawPhone?: string | undefined;
  readonly humanWorthScore?: string | undefined;
  readonly networkCallAttempted?: boolean | undefined;
};

export type PublicServiceEvidence = {
  readonly observationId: string;
  readonly sourceClass: ServiceSourceClass;
  readonly factType: 'SERVICE_DELIVERY';
  readonly claimType: ClaimType;
  readonly productiveCategory: ProductiveCategory;
  readonly serviceKind: ServiceKind;
  readonly completionState: ServiceCompletionState;
  readonly unit: string;
  readonly mantissa: string;
  readonly durationSeconds: bigint | null;
  readonly identity: ServiceIdentityBundle;
  readonly historicalMachineHourRecord: boolean;
  readonly containsPayload: false;
  readonly containsCustomerPii: false;
  readonly humanWorthScoring: false;
  readonly invoiceEqualsCompletion: false;
  readonly mintsMoonRey: false;
};

export function isServiceSourceClass(value: string): value is ServiceSourceClass {
  return (SERVICE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isServiceFactType(value: string): value is ServiceFactType {
  return (SERVICE_FACT_TYPES as readonly string[]).includes(value);
}

export function isForbiddenServiceFactType(value: string): value is ForbiddenServiceFactType {
  return (FORBIDDEN_SERVICE_FACT_TYPES as readonly string[]).includes(value);
}

export function isServiceCompleted(state: ServiceCompletionState): boolean {
  return (SERVICE_COMPLETED_STATES as readonly string[]).includes(state);
}

export function serviceFactCannotAutoMint(): true {
  if (SERVICE_FACT_AUTO_MINTS) {
    throw new Error('SERVICE_FACT_AUTO_MINTS');
  }
  return true;
}

export function invoiceDoesNotEqualCompletion(): true {
  if (INVOICE_EQUALS_COMPLETED_SERVICE) {
    throw new Error('INVOICE_EQUALS_COMPLETED_SERVICE');
  }
  return true;
}

export function bookingDoesNotEqualCompletion(): true {
  if (BOOKING_EQUALS_COMPLETED_SERVICE) {
    throw new Error('BOOKING_EQUALS_COMPLETED_SERVICE');
  }
  return true;
}

export function humanWorthScoringAbsent(): true {
  if (HUMAN_WORTH_SCORING) {
    throw new Error('HUMAN_WORTH_SCORING');
  }
  return true;
}
