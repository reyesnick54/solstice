import { type Brand, brandAs } from './brand.ts';
import type { Jurisdiction, Residency } from './jurisdiction.ts';
import type { LegalEntityId } from './legal-entity.ts';
import { err, ok, type Result } from './result.ts';
import type { UtcInstant } from './time.ts';

export type CustomerId = Brand<string, 'CustomerId'>;

export function asCustomerId(value: string): CustomerId {
  if (value.length === 0) {
    throw new TypeError('CustomerId must be a non-empty string');
  }
  return brandAs<string, 'CustomerId'>(value);
}

export const CUSTOMER_STATUSES = [
  'PROSPECT',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
] as const;

export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const KYC_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
] as const;

export type KycState = (typeof KYC_STATES)[number];

/**
 * Snapshot of KYC verification. This package models the state only;
 * it does not perform verification.
 */
export type VerificationState = {
  readonly kycState: KycState;
  readonly kycRecordVersion: number;
  readonly refreshBy: UtcInstant;
};

export type Customer = {
  readonly id: CustomerId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly residency: Residency;
  readonly status: CustomerStatus;
  readonly verification: VerificationState;
  readonly createdAt: UtcInstant;
  readonly version: number;
};

export type CreateProspectInput = {
  readonly id: CustomerId;
  readonly legalEntityId: LegalEntityId;
  readonly jurisdiction: Jurisdiction;
  readonly residency: Residency;
  readonly verification: VerificationState;
  readonly createdAt: UtcInstant;
};

/**
 * Allowed status moves. Same-status is not a transition. CLOSED is terminal.
 * PROSPECT cannot skip to ACTIVE — verification must be pending first.
 */
const ALLOWED_TRANSITIONS: { readonly [S in CustomerStatus]: readonly CustomerStatus[] } = {
  PROSPECT: ['PENDING_VERIFICATION', 'CLOSED'],
  PENDING_VERIFICATION: ['PROSPECT', 'ACTIVE', 'CLOSED'],
  ACTIVE: ['SUSPENDED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

export function isCustomerStatus(value: unknown): value is CustomerStatus {
  return (
    typeof value === 'string' &&
    (CUSTOMER_STATUSES as readonly string[]).includes(value)
  );
}

export function isKycState(value: unknown): value is KycState {
  return typeof value === 'string' && (KYC_STATES as readonly string[]).includes(value);
}

export function freezeVerification(state: VerificationState): VerificationState {
  return Object.freeze({
    kycState: state.kycState,
    kycRecordVersion: state.kycRecordVersion,
    refreshBy: state.refreshBy,
  });
}

export function notStartedVerification(refreshBy: UtcInstant): VerificationState {
  return freezeVerification({
    kycState: 'NOT_STARTED',
    kycRecordVersion: 0,
    refreshBy,
  });
}

function freezeCustomer(customer: Customer): Customer {
  return Object.freeze({
    id: customer.id,
    legalEntityId: customer.legalEntityId,
    jurisdiction: customer.jurisdiction,
    residency: customer.residency,
    status: customer.status,
    verification: freezeVerification(customer.verification),
    createdAt: customer.createdAt,
    version: customer.version,
  });
}

export function createProspect(input: CreateProspectInput): Customer {
  return freezeCustomer({
    id: input.id,
    legalEntityId: input.legalEntityId,
    jurisdiction: input.jurisdiction,
    residency: input.residency,
    status: 'PROSPECT',
    verification: input.verification,
    createdAt: input.createdAt,
    version: 0,
  });
}

export function canTransitionCustomerStatus(
  from: CustomerStatus,
  to: CustomerStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export type IllegalCustomerStatusTransition = {
  readonly code: 'ILLEGAL_CUSTOMER_STATUS_TRANSITION';
  readonly customerId: CustomerId;
  readonly from: CustomerStatus;
  readonly to: CustomerStatus;
};

export type CustomerStatusTransition = {
  readonly customer: Customer;
  readonly occurredAt: UtcInstant;
};

export type CustomerStatusTransitionResult = Result<
  CustomerStatusTransition,
  IllegalCustomerStatusTransition
>;

/**
 * Pure, total status transition. Never throws for an illegal request:
 * those are returned as `ok: false` rejections. `occurredAt` is supplied
 * by the caller (UTC); this function does not read the clock.
 */
export function transitionCustomerStatus(
  customer: Customer,
  requestedStatus: CustomerStatus,
  occurredAt: UtcInstant,
): CustomerStatusTransitionResult {
  if (!canTransitionCustomerStatus(customer.status, requestedStatus)) {
    return err(
      Object.freeze({
        code: 'ILLEGAL_CUSTOMER_STATUS_TRANSITION' as const,
        customerId: customer.id,
        from: customer.status,
        to: requestedStatus,
      }),
    );
  }

  const next = freezeCustomer({
    id: customer.id,
    legalEntityId: customer.legalEntityId,
    jurisdiction: customer.jurisdiction,
    residency: customer.residency,
    status: requestedStatus,
    verification: customer.verification,
    createdAt: customer.createdAt,
    version: customer.version + 1,
  });

  return ok(
    Object.freeze({
      customer: next,
      occurredAt,
    }),
  );
}
