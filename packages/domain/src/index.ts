export type { Brand } from './brand.ts';
export { brandAs } from './brand.ts';

export type { UtcInstant } from './time.ts';
export { asUtcInstant, isUtcInstant } from './time.ts';

export type { Jurisdiction, Residency } from './jurisdiction.ts';
export {
  asJurisdiction,
  asResidency,
  isJurisdiction,
  isResidency,
} from './jurisdiction.ts';

export type { LegalEntityId } from './legal-entity.ts';
export { asLegalEntityId } from './legal-entity.ts';

export type { Err, Ok, Result } from './result.ts';
export { err, isErr, isOk, ok } from './result.ts';

export type {
  CreateProspectInput,
  Customer,
  CustomerId,
  CustomerStatus,
  CustomerStatusTransition,
  CustomerStatusTransitionResult,
  IllegalCustomerStatusTransition,
  KycState,
  VerificationState,
} from './customer.ts';
export {
  asCustomerId,
  canTransitionCustomerStatus,
  createProspect,
  CUSTOMER_STATUSES,
  freezeVerification,
  isCustomerStatus,
  isKycState,
  KYC_STATES,
  notStartedVerification,
  transitionCustomerStatus,
} from './customer.ts';
