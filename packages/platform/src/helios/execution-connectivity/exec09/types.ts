import type { CustomerId, Jurisdiction, UtcInstant } from '@solstice/domain';
import type { HeliosFillId, HeliosOrderId } from '../../order-lifecycle/ids.ts';
import type { LocalDateKey } from '../../multi-asset/market-calendar/types.ts';
import type {
  Exec09AssetClass,
  Exec09CorrectionKind,
  Exec09DvpModel,
  Exec09SettlementFailureKind,
  Exec09SettlementLegKind,
  Exec09SettlementLifecycleState,
} from './taxonomy.ts';
import type {
  Exec09SettlementCorrectionId,
  Exec09SettlementFailureId,
  Exec09SettlementInstructionId,
  Exec09SettlementLegId,
  Exec09SettlementLifecycleId,
  Exec09SettlementObligationId,
  Exec09TradeConfirmationId,
} from './ids.ts';

export type VersionedSettlementPolicy = {
  readonly policyId: string;
  readonly version: string;
  readonly market: string;
  readonly assetClass: Exec09AssetClass;
  readonly jurisdiction: Jurisdiction;
  readonly effectiveFrom: LocalDateKey;
  readonly effectiveTo: LocalDateKey | null;
  readonly settlementLagBusinessDays: number;
  readonly marketCalendarId: string;
  readonly currencyCalendarId: string;
  readonly dvpModel: Exec09DvpModel;
  readonly providerSuppliesAtomicDvp: boolean;
};

export type SettlementCalendarPort = {
  readonly calendarId: string;
  readonly isBusinessDay: (date: LocalDateKey) => boolean;
  readonly addBusinessDays: (start: LocalDateKey, days: number) => LocalDateKey;
};

export type ExternalTradeConfirmation = {
  readonly confirmationId: Exec09TradeConfirmationId;
  readonly providerId: string;
  readonly providerTradeId: string;
  readonly orderId: HeliosOrderId;
  readonly customerId: CustomerId;
  readonly instrumentId: string;
  readonly assetClass: Exec09AssetClass;
  readonly market: string;
  readonly jurisdiction: Jurisdiction;
  readonly side: 'BUY' | 'SELL';
  readonly tradeDate: LocalDateKey;
  readonly tradeTimestamp: UtcInstant;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly notionalMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly providerPayloadRef: string | null;
  readonly busted: boolean;
  readonly simulation: true;
};

export type SettlementLeg = {
  readonly legId: Exec09SettlementLegId;
  readonly obligationId: Exec09SettlementObligationId;
  readonly kind: Exec09SettlementLegKind;
  readonly settlementInstructionId: Exec09SettlementInstructionId;
  readonly quantityUnits: string | null;
  readonly amountMinorUnits: string | null;
  readonly currency: string | null;
  readonly instrumentId: string | null;
  readonly settledQuantityUnits: string;
  readonly settledAmountMinorUnits: string;
  readonly lifecycleState: Exec09SettlementLifecycleState;
};

export type SettlementInstruction = {
  readonly instructionId: Exec09SettlementInstructionId;
  readonly obligationId: Exec09SettlementObligationId;
  readonly lifecycleId: Exec09SettlementLifecycleId;
  readonly customerId: CustomerId;
  readonly providerId: string;
  readonly legRefs: readonly Exec09SettlementLegId[];
  readonly contractualSettlementDate: LocalDateKey;
  readonly currencyCalendarId: string;
  readonly marketCalendarId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly dvpModel: Exec09DvpModel;
  readonly atomicDvpClaimedByProvider: boolean;
  readonly createdAt: UtcInstant;
  readonly simulation: true;
};

export type SettlementObligation = {
  readonly obligationId: Exec09SettlementObligationId;
  readonly lifecycleId: Exec09SettlementLifecycleId;
  readonly instructionId: Exec09SettlementInstructionId;
  readonly confirmationId: Exec09TradeConfirmationId;
  readonly orderId: HeliosOrderId;
  readonly fillId: HeliosFillId;
  readonly customerId: CustomerId;
  readonly providerId: string;
  readonly tradeDate: LocalDateKey;
  readonly contractualSettlementDate: LocalDateKey;
  readonly actualSettlementDate: LocalDateKey | null;
  readonly assetLegId: Exec09SettlementLegId;
  readonly cashLegId: Exec09SettlementLegId;
  readonly feeLegId: Exec09SettlementLegId | null;
  readonly state: Exec09SettlementLifecycleState;
  readonly quantityUnits: string;
  readonly settledQuantityUnits: string;
  readonly notionalMinorUnits: string;
  readonly settledNotionalMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly dvpModel: Exec09DvpModel;
  readonly providerSuppliesAtomicDvp: boolean;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly simulation: true;
};

export type SettlementLifecycle = {
  readonly lifecycleId: Exec09SettlementLifecycleId;
  readonly orderId: HeliosOrderId;
  readonly customerId: CustomerId;
  readonly providerId: string;
  readonly market: string;
  readonly assetClass: Exec09AssetClass;
  readonly jurisdiction: Jurisdiction;
  readonly tradeDate: LocalDateKey;
  readonly aggregateState: Exec09SettlementLifecycleState;
  readonly obligationIds: readonly Exec09SettlementObligationId[];
  readonly filledQuantityUnits: string;
  readonly settledQuantityUnits: string;
  readonly contractualSettlementDate: LocalDateKey | null;
  readonly actualSettlementDate: LocalDateKey | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly simulation: true;
};

export type SettlementFailure = {
  readonly failureId: Exec09SettlementFailureId;
  readonly obligationId: Exec09SettlementObligationId;
  readonly lifecycleId: Exec09SettlementLifecycleId;
  readonly kind: Exec09SettlementFailureKind;
  readonly description: string;
  readonly recoverable: boolean;
  readonly occurredAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly simulation: true;
};

export type SettlementCorrection = {
  readonly correctionId: Exec09SettlementCorrectionId;
  readonly obligationId: Exec09SettlementObligationId;
  readonly lifecycleId: Exec09SettlementLifecycleId;
  readonly kind: Exec09SettlementCorrectionKind;
  readonly priorState: Exec09SettlementLifecycleState;
  readonly quantityDeltaUnits: string | null;
  readonly notionalDeltaMinorUnits: string | null;
  readonly feeDeltaMinorUnits: string | null;
  readonly description: string;
  readonly correctedAt: UtcInstant;
  readonly evidenceRef: string | null;
  readonly simulation: true;
};

export type Exec09SettlementStoreSnapshot = {
  readonly policies: readonly VersionedSettlementPolicy[];
  readonly confirmations: readonly ExternalTradeConfirmation[];
  readonly instructions: readonly SettlementInstruction[];
  readonly obligations: readonly SettlementObligation[];
  readonly lifecycles: readonly SettlementLifecycle[];
  readonly failures: readonly SettlementFailure[];
  readonly corrections: readonly SettlementCorrection[];
  readonly legs: readonly SettlementLeg[];
};

export type Exec09SettlementFailureCode =
  | 'LIFECYCLE_NOT_FOUND'
  | 'OBLIGATION_NOT_FOUND'
  | 'CUSTOMER_MISMATCH'
  | 'INVALID_TRANSITION'
  | 'POLICY_NOT_FOUND'
  | 'CONFIRMATION_BUSTED'
  | 'DUPLICATE_FILL'
  | 'LIVE_GATE_BLOCKED';

export type Exec09SettlementDomainFailure = {
  readonly code: Exec09SettlementFailureCode;
  readonly message: string;
};

export type OpenSettlementFromFillInput = {
  readonly customerId: CustomerId;
  readonly orderId: HeliosOrderId;
  readonly fillId: HeliosFillId;
  readonly providerId: string;
  readonly providerFillId: string;
  readonly providerTradeId: string;
  readonly instrumentId: string;
  readonly assetClass: Exec09AssetClass;
  readonly market: string;
  readonly jurisdiction: Jurisdiction;
  readonly side: 'BUY' | 'SELL';
  readonly tradeTimestamp: UtcInstant;
  readonly quantityUnits: string;
  readonly priceMinorUnits: string;
  readonly notionalMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly providerPayloadRef?: string | null;
};
