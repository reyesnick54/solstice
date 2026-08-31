/**
 * ACCESS Wave 3 / Prompt 37 — transaction orchestration exports.
 */

export {
  ACCESS_TRANSACTION_TRANSITIONS,
  AccessTransactionStateMachine,
  assertAccessTransactionTransition,
  canTransitionAccessTransaction,
  isTerminalAccessTransactionStatus,
  TERMINAL_ACCESS_TRANSACTION_STATUSES,
} from './state-machine.ts';

export type {
  AccessCheckoutQuote,
  AccessFulfillmentEvidence,
  AccessReconciliationIssue,
  AccessReconciliationIssueType,
  AccessTransactionContext,
  AccessWebhookEvent,
  OrchestratorOutcome,
  PaymentAuthorizationResult,
  ProviderBookingStatusResult,
  ReconciliationResolutionStatus,
  ReconciliationSeverity,
} from './types.ts';

export { ACCESS_RECONCILIATION_ISSUE_TYPES, RECONCILIATION_SEVERITIES, RECONCILIATION_RESOLUTION_STATUSES } from './types.ts';

export { AccessCoverageEngine, type CoverageEngineInput, type CoverageEngineResult } from './coverage-engine.ts';
export { resolveFulfillmentPolicy, type AccessFulfillmentPolicy, type FulfillmentConsumptionPoint } from './fulfillment-policy.ts';
export {
  resolveEntitlementRestorationPolicy,
  type AccessEntitlementRestorationPolicy,
  type EntitlementRestorationDecision,
} from './entitlement-restoration-policy.ts';
export { allocateRefund, type RefundAllocation, type RefundAllocationPolicyId } from './refund-policy.ts';
export { AccessPaymentRail, type AccessPaymentRailConfig, type PaymentRailOutcome } from './payment-rail.ts';
export { AccessSettlementOrchestrator, type SettlementOrchestratorOutcome } from './settlement-orchestrator.ts';
export { ConfigurableSimulationProvider, type SimulationScenario } from './simulation-provider.ts';
export { AccessTransactionStore } from './store.ts';
export { compensateTransaction, type CompensationResult } from './saga.ts';
export { AccessReconciliationService, type ReconciliationOutcome } from './reconciliation.ts';
export { AccessWebhookOrchestrator, type WebhookOutcome } from './webhook-orchestrator.ts';
export {
  AccessTransactionOrchestrator,
  createAccessTransactionOrchestrator,
  type AccessTransactionOrchestratorDeps,
} from './orchestrator.ts';
