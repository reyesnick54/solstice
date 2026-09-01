export {
  RECURRING_FREQUENCIES,
  SUBSCRIPTION_CATEGORIES,
  OBLIGATION_STATUSES,
  CONFIDENCE_LEVELS,
  SAVINGS_OPPORTUNITY_TYPES,
  SUBSCRIPTION_ACTION_TYPES,
  ACTION_CAPABILITY_LEVELS,
  ACTION_LIFECYCLE_STATES,
  SAVINGS_KINDS,
  DUPLICATION_KINDS,
  SUBSCRIPTION_AUDIT_EVENTS,
  DISCRETIONARY_MERCHANT_PATTERNS,
  UTILITY_MERCHANT_PATTERNS,
  type RecurringFrequency,
  type SubscriptionCategory,
  type ObligationStatus,
  type ConfidenceLevel,
  type SavingsOpportunityType,
  type SubscriptionActionType,
  type ActionCapabilityLevel,
  type ActionLifecycleState,
  type SavingsKind,
  type DuplicationKind,
  type SubscriptionAuditEventKind,
} from './taxonomy.ts';
export type {
  ObservedTransaction,
  InferredClassification,
  MerchantIdentity,
  PriceChange,
  ActionCapabilities,
  RecurringObligation,
  DuplicationEvidence,
  UsageSignal,
  SavingsOpportunity,
  VerifiedSavings,
  SubscriptionActionProposal,
  SubscriptionApproval,
  SubscriptionAuditEvent,
  SubscriptionIntelligenceSnapshot,
} from './models.ts';
export {
  recurringObligationIdFor,
  savingsOpportunityIdFor,
  subscriptionActionIdFor,
  subscriptionApprovalIdFor,
  type RecurringObligationId,
  type SavingsOpportunityId,
  type SubscriptionActionId,
  type SubscriptionApprovalId,
} from './ids.ts';
export { normalizeMerchant, merchantsMatch } from './merchant.ts';
export { detectRecurringObligations } from './detection.ts';
export { classifySubscription, validateAiClassification } from './classification.ts';
export { detectPriceChanges, applyPriceChanges } from './price-change.ts';
export { detectDuplicateOverlaps } from './duplication.ts';
export { buildSavingsOpportunities } from './savings.ts';
export {
  defaultActionCapabilities,
  capabilityForAction,
  UnavailableSubscriptionActionProvider,
  SimulationSubscriptionActionProvider,
  resolveProvider,
  type SubscriptionActionProvider,
  type ProviderActionRequest,
  type ProviderActionResult,
} from './provider.ts';
export { authorizeAction, transitionActionState } from './authorization.ts';
export { proposeAction, isIdempotentRetry } from './execution.ts';
export { verifyProviderResult } from './verification.ts';
export {
  estimatedSavingsFromOpportunity,
  expectedSavingsFromOpportunity,
  attributeVerifiedSavings,
  savingsMustNotBePresentedAsVerified,
} from './attribution.ts';
export { createAuditEvent, SubscriptionAuditLog } from './audit.ts';
export { assertAiCannotExecute, rejectAiDirectExecution } from './ai-boundary.ts';
export { SubscriptionIntelligenceStore } from './store.ts';
export {
  SubscriptionIntelligenceService,
  type SubscriptionIntelligenceFailure,
} from './service.ts';
