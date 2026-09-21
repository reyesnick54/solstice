import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';
import type { M24ExecutionPlanId, M24ExitPlanId } from './ids.ts';
import type {
  M24ExecutionAssetClass,
  M24ExitKind,
  M24OrderLifecycleState,
  M24ReconciliationExceptionKind,
  M24SettlementCycle,
} from './taxonomy.ts';

/** Canonical M24 order record — preserves execution plan identity and provider evidence. */
export type MultiAssetOrderRecord = {
  readonly executionPlanId: M24ExecutionPlanId;
  readonly orderId: HeliosOrderId;
  readonly provider: string;
  readonly providerOrderId: string | null;
  readonly instrumentId: string;
  readonly assetClass: M24ExecutionAssetClass;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly quantityUnits: string;
  readonly submittedPriceMinorUnits: string | null;
  readonly limitPriceMinorUnits: string | null;
  readonly venue: string;
  readonly accountId: string;
  readonly customerId: CustomerId;
  readonly providerPayloadRef: string | null;
  readonly currentState: M24OrderLifecycleState;
  readonly settlementCycle: M24SettlementCycle;
  readonly evidenceRefs: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly submittedAt: UtcInstant | null;
  readonly acknowledgedAt: UtcInstant | null;
  readonly filledAt: UtcInstant | null;
  readonly settlementPendingAt: UtcInstant | null;
  readonly settledAt: UtcInstant | null;
  readonly reconciledAt: UtcInstant | null;
  readonly availableAt: UtcInstant | null;
  readonly simulation: true;
  readonly liveExecution: false;
};

/** Canonical M24 fill record. */
export type MultiAssetFillRecord = {
  readonly fillId: HeliosFillId;
  readonly providerFillId: string;
  readonly orderId: HeliosOrderId;
  readonly executionPlanId: M24ExecutionPlanId;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly feeCurrency: string;
  readonly liquidityRole: 'MAKER' | 'TAKER' | null;
  readonly slippageMinorUnits: string | null;
  readonly priceImprovementMinorUnits: string | null;
  readonly timestamp: UtcInstant;
  readonly venue: string | null;
  readonly evidenceRef: string | null;
  readonly simulation: true;
};

export type MultiAssetExitPlan = {
  readonly exitPlanId: M24ExitPlanId;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly assetClass: M24ExecutionAssetClass;
  readonly exitKind: M24ExitKind;
  readonly quantityUnits: string;
  readonly executionPlanId: M24ExecutionPlanId | null;
  readonly orderId: HeliosOrderId | null;
  readonly authorized: boolean;
  readonly authorityReference: string | null;
  readonly evidenceRefs: readonly string[];
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type MultiAssetCashAvailability = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly currency: string;
  readonly totalAccountEquityMinor: string;
  readonly unrealizedPnlMinor: string;
  readonly realizedPnlMinor: string;
  readonly unsettledCashMinor: string;
  readonly settledCashMinor: string;
  readonly reservedCapitalMinor: string;
  readonly availableCapitalMinor: string;
  readonly withdrawableCashMinor: string;
  readonly asOf: UtcInstant;
  readonly serverCalculated: true;
};

export type MultiAssetReconciliationException = {
  readonly exceptionId: string;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly kind: M24ReconciliationExceptionKind;
  readonly description: string;
  readonly providerValue: string | null;
  readonly canonicalValue: string | null;
  readonly orderId: HeliosOrderId | null;
  readonly evidenceRef: string | null;
  readonly detectedAt: UtcInstant;
  readonly resolved: boolean;
};

export type MultiAssetReconciliationRun = {
  readonly runId: string;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly matched: boolean;
  readonly exceptions: readonly MultiAssetReconciliationException[];
  readonly evidenceRef: string | null;
  readonly completedAt: UtcInstant;
};

export type MultiAssetExecutionStoreSnapshot = {
  readonly orders: readonly MultiAssetOrderRecord[];
  readonly fills: readonly MultiAssetFillRecord[];
  readonly exitPlans: readonly MultiAssetExitPlan[];
  readonly reconciliationRuns: readonly MultiAssetReconciliationRun[];
  readonly exceptions: readonly MultiAssetReconciliationException[];
};

export type MultiAssetExecutionFailureCode =
  | 'ORDER_NOT_FOUND'
  | 'CUSTOMER_MISMATCH'
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_SUBMISSION'
  | 'TIMEOUT_REQUIRES_RECONCILIATION'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'RECONCILIATION_REQUIRED'
  | 'POSITION_NOT_FOUND'
  | 'INSUFFICIENT_CAPITAL'
  | 'LIVE_GATE_BLOCKED';

export type MultiAssetExecutionFailure = {
  readonly code: MultiAssetExecutionFailureCode;
  readonly message: string;
};

export type SubmitMultiAssetOrderInput = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly workOrderId: string;
  readonly proposalId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly notionalMinorUnits: string;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly limitPriceMinorUnits?: string | null;
  readonly submittedPriceMinorUnits?: string | null;
  readonly currency: string;
  readonly providerRoute: string;
  readonly venue: string;
  readonly idempotencyKey: string;
  readonly envelopeId?: string | null;
  readonly strategyCapsuleRef?: import('../../strategy-capsule/types.ts').StrategyCapsuleRef | null;
};

export type AuthorizeExitInput = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly exitKind: M24ExitKind;
  readonly workOrderId: string;
  readonly proposalId: string;
  readonly idempotencyKey: string;
  readonly authorityReference: string;
};
