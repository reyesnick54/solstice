export type { ActionIntent, IntentId, PurposeCode } from './action-intent.ts';
export { asIntentId, isPurposeCode, PURPOSE_CODES } from './action-intent.ts';

export type {
  AcceptFxQuoteIntent,
  AcceptFxQuotePayload,
  AcceptInboundPaymentIntent,
  AcceptInboundPaymentPayload,
  ActionType,
  BankingIntent,
  CancelPaymentIntent,
  CancelPaymentPayload,
  CaptureHoldIntent,
  CancelHoldIntent,
  CreateBeneficiaryIntent,
  CreateBeneficiaryPayload,
  CreateFxQuoteIntent,
  CreateFxQuotePayload,
  CreateHoldIntent,
  CreateHoldPayload,
  HoldLifecyclePayload,
  InitiatePaymentIntent,
  InitiatePaymentPayload,
  InitiatePendingSettlementIntent,
  InitiatePendingSettlementPayload,
  InternalTransferIntent,
  InternalTransferPayload,
  OpenAccountIntent,
  OpenAccountPayload,
  PaymentIntent,
  PendingSettlementLifecyclePayload,
  PostDepositIntent,
  PostDepositPayload,
  PostFeeIntent,
  PostFeePayload,
  PostInterestIntent,
  PostInterestPayload,
  PostReversalIntent,
  PostReversalPayload,
  PostWithdrawalIntent,
  PostWithdrawalPayload,
  ReleaseHoldIntent,
  ReturnPendingIntent,
  SettlePendingIntent,
} from './action-types.ts';
export { ACTION_TYPES } from './action-types.ts';

export type {
  AuthorizationDecision,
  DecisionStatus,
  PolicyDecisionRef,
  ProofEvaluation,
  ProofName,
} from './decision.ts';
export { combineProofs, DECISION_RANK, DECISION_STATUSES, PROOF_NAMES } from './decision.ts';

export type {
  AuthorityIssuerSource,
  AuthorityScope,
  AuthorityVerificationFailure,
  ExecutionAuthority,
  IssueAuthorityInput,
  VerifiedExecutionAuthority,
} from './execution-authority.ts';
export {
  AUTHORITY_TTL_MS,
  AuthorityIssuer,
  isVerifiedExecutionAuthority,
} from './execution-authority.ts';

export type { StructuralCatalog, StructuralRejection, StructuralValidationResult } from './structural.ts';
export { validateIntentStructure } from './structural.ts';
