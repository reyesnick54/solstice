export type {
  ActionIntent,
  ActorKind,
  ActorRef,
  AuthorizationDecision,
  AuthorizationDecisionStatus,
  ExecutionAuthority,
  IntentId,
} from '../../permissions/src/index.ts';
export {
  ACTOR_KINDS,
  asIntentId,
  AUTHORIZATION_DECISION_STATUSES,
  createActionIntent,
  PROOF_CLASSES,
} from '../../permissions/src/index.ts';

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

export type { Currency } from './currency.ts';
export { asCurrency, isCurrency } from './currency.ts';

export type { AccountClass } from './account-class.ts';
export { ACCOUNT_CLASSES, isAccountClass } from './account-class.ts';

export type { CreateLegalEntityInput, LegalEntity, LegalEntityId } from './legal-entity.ts';
export { asLegalEntityId, createLegalEntity } from './legal-entity.ts';

export type {
  CreateProductInput,
  Product,
  ProductCatalog,
  ProductId,
} from './product.ts';
export { asProductId, createProduct, lookupProduct } from './product.ts';

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

export type {
  Account,
  AccountId,
  AccountStatus,
  AccountStatusTransition,
  AccountStatusTransitionResult,
  IllegalAccountStatusTransition,
  OpenAccountInput,
} from './account.ts';
export {
  ACCOUNT_STATUSES,
  asAccountId,
  canTransitionAccountStatus,
  isAccountStatus,
  openAccount,
  transitionAccountStatus,
} from './account.ts';

export type {
  CreateOpenAccountIntentInput,
  LegalEntityCatalog,
  OpenAccountActionType,
  OpenAccountCatalog,
  OpenAccountIntent,
  OpenAccountPayload,
  OpenAccountValidationFailure,
  OpenAccountValidationResult,
} from './open-account.ts';
export {
  createOpenAccountIntent,
  OPEN_ACCOUNT,
  validateOpenAccountIntent,
} from './open-account.ts';
