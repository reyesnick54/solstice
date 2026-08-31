/**
 * ACCESS Wave 3 Prompt 35 — Fiat settlement orchestration exports.
 */

export {
  ACCESS_SETTLEMENT_ORCHESTRATION_SCHEMA,
  ACCESS_SETTLEMENT_ORCHESTRATION_CHUNK,
  ACCESS_SETTLEMENT_ORCHESTRATION_STATUSES,
  ACCESS_PAYMENT_RAIL_KINDS,
  ACCESS_PAYMENT_RAIL_CAPABILITIES,
  ACCESS_SETTLEMENT_STRATEGIES,
  ACCESS_PAYMENT_REMOTE_STATUSES,
  ACCESS_SETTLEMENT_OPERATIONS,
  LAUNCH_TOKEN_CONVERSION_CONTRIBUTION,
  isAccessSettlementOrchestrationStatus,
  isAccessPaymentRailKind,
  railSupportsCapability,
  type AccessSettlementOrchestrationStatus,
  type AccessPaymentRailKind,
  type AccessPaymentRailCapability,
  type AccessSettlementStrategy,
  type AccessPaymentRemoteStatus,
  type AccessSettlementOperation,
} from './taxonomy.ts';

export type {
  AccessCheckoutQuote,
  AccessSettlementPlan,
  AccessSettlementSourceOfFunds,
  AccessRefundAllocation,
  AccessSettlementEvidenceTrail,
  AccessSettlementRecord,
  AccessSettlementFailureCode,
  AccessSettlementFailure,
  AccessPaymentRailDescriptor,
  AccessPaymentAuthorizationResult,
  AccessPaymentCaptureResult,
  AccessPaymentVoidResult,
  AccessPaymentRefundResult,
  AccessPaymentStatusResult,
  AccessPaymentReconcileResult,
  ProviderPaymentMethodRef,
  UserFundingSourceRef,
} from './types.ts';

export {
  settlementFailure,
  computeProviderSettlementAmount,
  validateSettlementEquation,
  sourceOfFundsFromPlan,
  validateCheckoutQuote,
  validateSettlementPlan,
  allocateProportionalRefund,
  buildSettlementPlanFromQuote,
} from './invariants.ts';

export type {
  ComplianceGatePort,
  UserFundingPort,
  CanonicalFiatLedgerPort,
  SettlementEvidencePort,
} from './ports.ts';

export type {
  AccessPaymentRail,
  AccessPaymentRailAuthorizeInput,
  AccessPaymentRailCaptureInput,
  AccessPaymentRailVoidInput,
  AccessPaymentRailRefundInput,
  AccessPaymentRailStatusInput,
  AccessPaymentRailReconcileInput,
} from './payment-rail.ts';
export { assertRailCapability } from './payment-rail.ts';

export {
  AccessSettlementOrchestrator,
  createAccessSettlementOrchestrator,
  type AccessSettlementOrchestratorDeps,
  type SettlementOperationResult,
} from './orchestrator.ts';

export {
  SimulatedAccessPaymentRail,
  SimulatedUserFundingPort,
  SimulatedComplianceGatePort,
  SimulatedCanonicalFiatLedgerPort,
  SimulatedSettlementEvidencePort,
  type SimulatedPaymentRailOptions,
} from './rails/simulated.ts';
