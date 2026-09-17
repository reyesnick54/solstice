import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CreatePaperOrderIntent } from '../../../../permissions/src/action-types.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type {
  CapitalLifecycleStage,
  CapitalReservationKind,
  ExitReason,
  ExitType,
  MismatchKind,
  ReconciliationOutcome,
  ReinvestmentRefusalCode,
  WithdrawalState,
} from './taxonomy.ts';
import type {
  CapitalReconciliationRunId,
  CapitalReservationId,
  HeliosExitRequestId,
  HeliosWithdrawalRequestId,
} from './ids.ts';

export type CapitalLifecycleFailureCode =
  | 'CUSTOMER_MISMATCH'
  | 'POSITION_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'KERNEL_REFUSED'
  | 'INSUFFICIENT_WITHDRAWABLE'
  | 'DESTINATION_UNVERIFIED'
  | 'DUPLICATE_WITHDRAWAL'
  | 'RECONCILE_FIRST'
  | 'MISMATCH_BLOCKS_AVAILABILITY'
  | 'GROW_PAUSED'
  | 'AUTHORITY_REFUSED'
  | 'PROVIDER_UNAVAILABLE'
  | 'NOT_FOUND'
  | 'INVALID_STATE';

export type CapitalLifecycleFailure = {
  readonly code: CapitalLifecycleFailureCode;
  readonly message: string;
};

export type VerifiedDestination = {
  readonly destinationId: string;
  readonly coordinateRef: string;
  readonly verified: true;
  readonly ownerId: CustomerId;
};

export type DestinationVerificationPort = {
  verify(input: {
    readonly customerId: CustomerId;
    readonly destinationId: string;
    readonly currency: string;
  }): { readonly ok: true; readonly destination: VerifiedDestination } | { readonly ok: false; readonly code: string; readonly message: string };
};

export type InvestmentSettlementSnapshot = {
  readonly settlementId: string;
  readonly fillId: string;
  readonly state: 'TRADE_DATE' | 'PENDING_SETTLEMENT' | 'SETTLED';
  readonly side: 'BUY' | 'SELL';
  readonly cashAmountMinor: string;
  readonly currency: string;
};

export type InvestmentPositionSnapshot = {
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly settledQuantityUnits: string;
};

export type InvestmentLifecyclePort = {
  readonly createPaperOrder: (intent: CreatePaperOrderIntent) => {
    readonly outcome: 'OK' | 'KERNEL_REFUSED' | 'REJECTED';
    readonly value?: { readonly orderId: string; readonly fillId?: string };
    readonly code?: string;
    readonly message?: string;
    readonly authorityId?: string | null;
  };
  readonly settleInvestment: (input: {
    readonly settlementId: string;
    readonly idempotencyKey: string;
    readonly actorId: string;
    readonly now: UtcInstant;
  }) => {
    readonly outcome: 'OK' | 'KERNEL_REFUSED' | 'REJECTED';
    readonly value?: { readonly settlementId: string };
    readonly code?: string;
    readonly message?: string;
    readonly replay?: boolean;
  };
  readonly withdrawBrokerageCash: (input: {
    readonly idempotencyKey: string;
    readonly actorId: string;
    readonly now: UtcInstant;
    readonly brokerageAccountId: string;
    readonly destinationAccountId: string;
    readonly amountMinor: string;
    readonly currency: string;
  }) => {
    readonly outcome: 'OK' | 'KERNEL_REFUSED' | 'REJECTED';
    readonly value?: { readonly journalId: string };
    readonly code?: string;
    readonly message?: string;
    readonly replay?: boolean;
  };
  readonly reconcileInvestmentAccount: (investmentAccountId: string) => {
    readonly result: 'MATCHED' | 'PENDING' | 'POSITION_MISMATCH' | 'CASH_MISMATCH' | 'MISSING_FILL' | 'MISSING_INTERNAL' | 'INVESTIGATION_REQUIRED';
    readonly findings: readonly string[];
    readonly reconciliationId: string;
  };
  readonly listSettlements: (investmentAccountId: string) => readonly InvestmentSettlementSnapshot[];
  readonly listPositions: (investmentAccountId: string) => readonly InvestmentPositionSnapshot[];
  readonly brokerageCashBalance: (brokerageAccountId: string, currency: string) => string;
  readonly pendingSettlementTotal: (investmentAccountId: string, currency: string) => string;
  readonly investmentCustomerId?: (investmentAccountId: string) => CustomerId | null;
};

export type MandateLifecycleContext = {
  readonly mandateActive: boolean;
  readonly growPaused: boolean;
  readonly liquidityRetentionMinor: string;
  readonly reinvestmentPermitted: boolean;
};

export type HeliosExitRequest = {
  readonly exitRequestId: HeliosExitRequestId;
  readonly customerId: CustomerId;
  readonly investmentAccountId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly positionInstrumentId: string;
  readonly exitType: ExitType;
  readonly reason: ExitReason;
  readonly requestedQuantityUnits: string;
  readonly remainingQuantityUnits: string;
  readonly providerRoute: string | null;
  readonly authorityEvidenceId: string | null;
  readonly orderId: string | null;
  readonly fillId: string | null;
  readonly settlementId: string | null;
  readonly stage: CapitalLifecycleStage;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type HeliosWithdrawalRequest = {
  readonly withdrawalRequestId: HeliosWithdrawalRequestId;
  readonly customerId: CustomerId;
  readonly sourceAccountId: string;
  readonly destinationId: string;
  readonly destinationCoordinateRef: string;
  readonly amount: SerializedMoney;
  readonly operationId: string;
  readonly fundingRail: string;
  readonly mandateRef: string | null;
  readonly environment: 'simulation';
  readonly state: WithdrawalState;
  readonly journalId: string | null;
  readonly idempotencyKey: string;
  readonly timeoutAt: UtcInstant | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type CapitalReconciliationRun = {
  readonly runId: CapitalReconciliationRunId;
  readonly customerId: CustomerId;
  readonly investmentAccountId: string;
  readonly outcome: ReconciliationOutcome;
  readonly mismatchKinds: readonly MismatchKind[];
  readonly findings: readonly string[];
  readonly blocksAvailability: boolean;
  readonly investmentReconciliationId: string | null;
  readonly createdAt: UtcInstant;
};

export type CapitalReservation = {
  readonly reservationId: CapitalReservationId;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly kind: CapitalReservationKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly operationId: string;
  readonly active: boolean;
  readonly createdAt: UtcInstant;
};

export type WithdrawableCashSnapshot = {
  readonly customerId: CustomerId;
  readonly brokerageAccountId: string;
  readonly currency: string;
  readonly ledgerSettledMinor: string;
  readonly reconciledMinor: string;
  readonly reservedMinor: string;
  readonly investedMinor: string;
  readonly restrictedMinor: string;
  readonly withdrawableMinor: string;
  readonly profitOnScreenMinor: string;
  readonly asOf: UtcInstant;
  readonly serverCalculated: true;
};

export type ReinvestmentEligibility = {
  readonly eligible: boolean;
  readonly availableMinor: string;
  readonly currency: string;
  readonly refusalCodes: readonly ReinvestmentRefusalCode[];
  readonly requiresNewAuthority: true;
};

export type CapitalLifecycleCheckpoint = {
  readonly exits: readonly HeliosExitRequest[];
  readonly withdrawals: readonly HeliosWithdrawalRequest[];
  readonly reconciliations: readonly CapitalReconciliationRun[];
  readonly reservations: readonly CapitalReservation[];
};

export type RequestExitInput = {
  readonly customerId: CustomerId;
  readonly investmentAccountId: string;
  readonly brokerageAccountId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly instrumentId: string;
  readonly exitType: ExitType;
  readonly reason: ExitReason;
  readonly quantityUnits: string;
  readonly actorId: string;
  readonly providerRoute: string | null;
  readonly idempotencyKey: string;
  readonly orderIntent: CreatePaperOrderIntent;
};

export type RequestWithdrawalInput = {
  readonly customerId: CustomerId;
  readonly sourceAccountId: string;
  readonly investmentAccountId: string;
  readonly destinationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly operationId: string;
  readonly fundingRail: string;
  readonly mandateRef: string | null;
  readonly actorId: string;
  readonly idempotencyKey: string;
};

export type ReserveCapitalInput = {
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly investmentAccountId: string;
  readonly kind: CapitalReservationKind;
  readonly amountMinor: string;
  readonly currency: string;
  readonly operationId: string;
};
