export {
  FORBIDDEN_AUTOMATIC_MONETIZATION_TRAITS,
  HIN_CATEGORY_RECORDS,
  HIN_CATEGORY_REGISTRY,
  HIN_CATEGORY_REGISTRY_ID,
  HIN_CATEGORY_REGISTRY_VERSION,
  HIN_PRODUCT_CATEGORIES,
  canonicalClassFor,
  categoryRequiresConsent,
  categoryRequiresRights,
  isHinProductCategory,
} from './categories.ts';
export type { HinCategoryRecord, HinProductCategory } from './categories.ts';
export {
  HIN_VERIFICATION_STATES,
  HIN_VERIFICATION_TREATMENT,
  isHinVerificationState,
  mapRegistryToHinVerification,
  verificationEligibleForValueInput,
  verificationWeightBps,
} from './verification.ts';
export type { HinVerificationState } from './verification.ts';
export {
  HIN_ACTORS,
  HIN_DISPUTE_KINDS,
  HIN_DISPUTE_STATES,
  HIN_ECONOMIC_VALUE_INPUT_UNIT,
  HIN_FAILURE_CODES,
  HIN_VALUE_SCHEMA_VERSION,
  hinFailure,
} from './types.ts';
export type {
  HinActor,
  HinActorKind,
  HinAggregateMetrics,
  HinAnomalyFlag,
  HinContributionRecord,
  HinCustomerSummary,
  HinDispute,
  HinDisputeKind,
  HinEconomicValueInput,
  HinFailure,
  HinFailureCode,
  HinIssuanceBasisProposal,
  HinProvenance,
} from './types.ts';
export {
  DEFAULT_HIN_METHODOLOGY_ID,
  DEFAULT_HIN_METHODOLOGY_VERSION,
  HIN_METHODOLOGY_GOVERNANCE_STATUSES,
  HIN_METHODOLOGY_REGISTRY_ID,
  HIN_METHODOLOGY_REGISTRY_VERSION,
  HinValuationMethodologyRegistry,
  defaultHinMethodology,
} from './methodologies.ts';
export type { HinMethodologyGovernanceStatus, HinMethodologyRecord } from './methodologies.ts';
export { computeHinEconomicValueInput } from './value-input.ts';
export { HinCapLedger, detectQuantitySpike } from './caps.ts';
export { hinReplayKey, isAnonymousSubject } from './duplicate.ts';
export { HIN_K_ANONYMITY_THRESHOLD, aggregateHinMetrics } from './metrics.ts';
export { customerHinSummary } from './customer.ts';
export { createHinIssuanceBasisProposal, refuseHinIssuanceAuthorization, refuseHinMint } from './issuance-basis.ts';
export {
  HIN_AI_ROLE,
  aiClassifyCategory,
  aiExplainValueInput,
  aiFlagAnomaly,
  aiSummarizeMetrics,
  boundedCategorySchema,
  refuseAiAuthority,
} from './ai.ts';
export { HinEconomicValueEngine, createHinEconomicValueEngine } from './engine.ts';
export type { HinSubmitInput } from './engine.ts';
