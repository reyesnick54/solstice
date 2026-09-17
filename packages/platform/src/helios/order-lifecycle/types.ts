import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { DecisionValidityEnvelopeId } from '../decision-validity/ids.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';
import type {
  HeliosCancelStatus,
  HeliosOrderEnvironment,
  HeliosOrderSide,
  HeliosOrderStatus,
  HeliosOrderType,
  HeliosReconciliationStatus,
  HeliosSettlementStatus,
  HeliosTimeInForce,
  HeliosWebhookVerification,
} from './taxonomy.ts';
import type {
  HeliosFillId,
  HeliosOperationId,
  HeliosOrderId,
  HeliosProviderEventId,
  HeliosSettlementId,
} from './ids.ts';

export type HeliosOrder = {
  readonly orderId: HeliosOrderId;
  readonly operationId: HeliosOperationId;
  readonly externalOperationId: string;
  readonly customerId: CustomerId;
  readonly providerAccountId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly strategyCapsuleRef: StrategyCapsuleRef | null;
  readonly proposalId: string;
  readonly envelopeId: DecisionValidityEnvelopeId | null;
  readonly authorityReference: string | null;
  readonly instrumentId: string;
  readonly side: HeliosOrderSide;
  readonly quantityUnits: string;
  readonly notionalMinorUnits: string;
  readonly orderType: HeliosOrderType;
  readonly limitPriceMinorUnits: string | null;
  readonly timeInForce: HeliosTimeInForce;
  readonly currency: string;
  readonly providerRoute: string;
  readonly environment: HeliosOrderEnvironment;
  readonly status: HeliosOrderStatus;
  readonly cancelStatus: HeliosCancelStatus | null;
  readonly providerOrderId: string | null;
  readonly reservationId: string | null;
  readonly capitalReservedMinorUnits: string;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly submittedAt: UtcInstant | null;
  readonly acknowledgedAt: UtcInstant | null;
  readonly filledAt: UtcInstant | null;
  readonly settledAt: UtcInstant | null;
  readonly reconciledAt: UtcInstant | null;
  readonly availableAt: UtcInstant | null;
  readonly liveExecution: false;
  readonly productionAuthorized: false;
  readonly grantsFinancialEffect: false;
};

export type HeliosFill = {
  readonly fillId: HeliosFillId;
  readonly orderId: HeliosOrderId;
  readonly providerFillId: string;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly notionalMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly venue: string | null;
  readonly liquidityRole: 'MAKER' | 'TAKER' | null;
  readonly providerTimestamp: UtcInstant;
  readonly arrivedAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly simulation: true;
  readonly liveSecuritiesExecution: false;
};

export type HeliosSettlement = {
  readonly settlementId: HeliosSettlementId;
  readonly orderId: HeliosOrderId;
  readonly fillId: HeliosFillId;
  readonly assetLeg: { readonly instrumentId: string; readonly quantityUnits: string };
  readonly cashLeg: { readonly minorUnits: string; readonly currency: string };
  readonly expectedSettlementDate: UtcInstant;
  readonly actualSettlementDate: UtcInstant | null;
  readonly status: HeliosSettlementStatus;
  readonly feeAdjustmentMinorUnits: string;
  readonly custodyState: string | null;
  readonly evidenceRef: string | null;
  readonly ledgerJournalRef: string | null;
  readonly simulation: true;
};

export type HeliosOrderAggregation = {
  readonly filledQuantityUnits: string;
  readonly remainingQuantityUnits: string;
  readonly weightedAveragePriceMinor: string;
  readonly totalFeeMinor: string;
  readonly currency: string;
  readonly fillCount: number;
};

export type HeliosReconciliationRecord = {
  readonly orderId: HeliosOrderId;
  readonly operationId: HeliosOperationId;
  readonly status: HeliosReconciliationStatus;
  readonly providerStatus: string | null;
  readonly canonicalStatus: HeliosOrderStatus;
  readonly discrepancyNotes: readonly string[];
  readonly reconciledAt: UtcInstant;
  readonly evidenceRef: string | null;
};

export type HeliosProviderEvent = {
  readonly eventId: HeliosProviderEventId;
  readonly orderId: HeliosOrderId | null;
  readonly operationId: HeliosOperationId | null;
  readonly customerId: CustomerId;
  readonly eventKind: string;
  readonly rawPayload: string;
  readonly verification: HeliosWebhookVerification;
  readonly processedAt: UtcInstant | null;
  readonly deduplicated: boolean;
};

export type HeliosOrderLifecycleStoreSnapshot = {
  readonly orders: readonly HeliosOrder[];
  readonly fills: readonly HeliosFill[];
  readonly settlements: readonly HeliosSettlement[];
  readonly providerEvents: readonly HeliosProviderEvent[];
  readonly reconciliations: readonly HeliosReconciliationRecord[];
  readonly processedEventIds: readonly HeliosProviderEventId[];
};

export type HeliosOrderFailure = {
  readonly code:
    | 'ORDER_NOT_FOUND'
    | 'CUSTOMER_MISMATCH'
    | 'OPERATION_ALREADY_EXISTS'
    | 'INVALID_TRANSITION'
    | 'ENVELOPE_INVALID'
    | 'ENVELOPE_EXPIRED'
    | 'MANDATE_REVOKED'
    | 'INSUFFICIENT_CAPITAL'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_REJECTED'
    | 'DUPLICATE_SUBMISSION'
    | 'TIMEOUT_REQUIRES_RECONCILIATION'
    | 'CANNOT_CANCEL'
    | 'WEBHOOK_INVALID'
    | 'WEBHOOK_REPLAY'
    | 'NOT_SIMULATION'
    | 'LIVE_GATE_BLOCKED';
  readonly message: string;
};

export type CreateHeliosOrderInput = {
  readonly customerId: CustomerId;
  readonly providerAccountId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly strategyCapsuleRef: StrategyCapsuleRef | null;
  readonly proposalId: string;
  readonly envelopeId: DecisionValidityEnvelopeId | null;
  readonly instrumentId: string;
  readonly side: HeliosOrderSide;
  readonly quantityUnits: string;
  readonly notionalMinorUnits: string;
  readonly orderType: HeliosOrderType;
  readonly limitPriceMinorUnits?: string | null;
  readonly timeInForce: HeliosTimeInForce;
  readonly currency: string;
  readonly providerRoute: string;
  readonly environment: HeliosOrderEnvironment;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type HeliosOrderValidationPorts = {
  readonly envelopeValid: (envelopeId: DecisionValidityEnvelopeId | null, now: UtcInstant) => boolean;
  readonly mandateActive: (workOrderId: EconomicWorkOrderId, customerId: CustomerId) => boolean;
  readonly accountOwned: (customerId: CustomerId, accountId: string) => boolean;
  readonly capitalAvailable: (
    customerId: CustomerId,
    accountId: string,
    amountMinorUnits: string,
    currency: string,
  ) => boolean;
  readonly providerCapable: (providerRoute: string, instrumentId: string) => boolean;
  readonly marketOpen: (instrumentId: string) => boolean;
  readonly riskPermits: (input: {
    readonly customerId: CustomerId;
    readonly instrumentId: string;
    readonly notionalMinorUnits: string;
    readonly side: HeliosOrderSide;
  }) => boolean;
  readonly kernelPermits: (input: {
    readonly customerId: CustomerId;
    readonly workOrderId: EconomicWorkOrderId;
    readonly proposalId: string;
  }) => { readonly permitted: boolean; readonly authorityReference: string | null };
};

export type HeliosCapitalPort = {
  readonly reserve: (input: {
    readonly orderId: HeliosOrderId;
    readonly customerId: CustomerId;
    readonly accountId: string;
    readonly amountMinorUnits: string;
    readonly currency: string;
    readonly idempotencyKey: string;
  }) => { readonly ok: true; readonly reservationId: string } | { readonly ok: false; readonly message: string };
  readonly release: (input: {
    readonly reservationId: string;
    readonly reason: string;
  }) => void;
};
