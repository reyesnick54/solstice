export type { ActionIntent, IntentId, PurposeCode } from './action-intent.ts';
export { asIntentId, isPurposeCode, PURPOSE_CODES } from './action-intent.ts';

export type {
  ActionType,
  BankingIntent,
  InternalTransferIntent,
  InternalTransferPayload,
  OpenAccountIntent,
  OpenAccountPayload,
  PostDepositIntent,
  PostDepositPayload,
  PostWithdrawalIntent,
  PostWithdrawalPayload,
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
