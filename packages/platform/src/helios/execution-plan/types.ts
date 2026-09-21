import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { DecisionValidityEnvelopeId } from '../decision-validity/ids.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { StrategyCapsuleRef } from '../strategy-capsule/types.ts';
import type { ExecutionPlanId, ExecutionPlanTransitionId } from './ids.ts';
import type {
  AtomicityPreference,
  ExecutionAssetClass,
  ExecutionPlanDirection,
  ExecutionPlanStatus,
  LegOrderingRequirement,
  OrderIntentType,
} from './taxonomy.ts';

export type VenueProviderConstraints = {
  readonly permittedProviders: readonly string[];
  readonly excludedProviders: readonly string[];
  readonly preferredProvider: string | null;
  readonly routePolicyVersion: string;
};

export type OrderStyleConstraints = {
  readonly orderIntent: OrderIntentType;
  readonly allowPartialFills: boolean;
  readonly minimumFillRatioBps: number | null;
};

export type PriceConstraints = {
  readonly limitPriceMinorUnits: string | null;
  readonly maxPriceMinorUnits: string | null;
  readonly minPriceMinorUnits: string | null;
  readonly referencePriceMinorUnits: string | null;
  readonly priceBandBps: number | null;
};

export type TimeConstraints = {
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly sessionOnly: boolean;
  readonly avoidAuctionPeriods: boolean;
};

export type SlippageConstraints = {
  readonly maxSlippageBps: number;
  readonly estimatedSlippageBps: number;
};

export type SpreadConstraints = {
  readonly maxSpreadBps: number;
  readonly referenceSpreadBps: number | null;
};

export type LiquidityConstraints = {
  readonly minimumLiquidityScoreBps: number;
  readonly maxParticipationRateBps: number | null;
  readonly averageDailyVolumeMinor: string | null;
};

export type ExecutionPlanConstraints = {
  readonly venueProvider: VenueProviderConstraints;
  readonly orderStyle: OrderStyleConstraints;
  readonly price: PriceConstraints;
  readonly time: TimeConstraints;
  readonly slippage: SlippageConstraints;
  readonly spread: SpreadConstraints;
  readonly liquidity: LiquidityConstraints;
};

export type ExecutionPlanLeg = {
  readonly legId: string;
  readonly legIndex: number;
  readonly instrumentId: string;
  readonly assetClass: ExecutionAssetClass;
  readonly direction: ExecutionPlanDirection;
  readonly targetQuantityUnits: string;
  readonly targetNotionalMinorUnits: string;
  readonly maximumApprovedQuantityUnits: string;
  readonly maximumApprovedNotionalMinorUnits: string;
  readonly executionCurrency: string;
  readonly constraints: ExecutionPlanConstraints;
  readonly hedgeRole: string | null;
};

export type MultiLegCoordination = {
  readonly legOrdering: LegOrderingRequirement;
  readonly hedgeRelationships: readonly string[];
  readonly acceptableLegImbalanceBps: number;
  readonly timeoutMs: number;
  readonly unwindRequiredOnFailure: boolean;
  readonly atomicityPreference: AtomicityPreference;
};

export type ExecutionPlanAuthorizationRefs = {
  readonly riskAuthorizationReference: string | null;
  readonly complianceAuthorizationReference: string | null;
  readonly capitalReservationReference: string | null;
};

export type ExecutionPlanTransitionRecord = {
  readonly transitionId: ExecutionPlanTransitionId;
  readonly executionPlanId: ExecutionPlanId;
  readonly fromStatus: ExecutionPlanStatus;
  readonly toStatus: ExecutionPlanStatus;
  readonly idempotencyKey: string;
  readonly evidenceRef: string | null;
  readonly transitionedAt: UtcInstant;
};

export type ExecutionPlan = {
  readonly executionPlanId: ExecutionPlanId;
  readonly customerId: CustomerId;
  readonly mandateId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly opportunityId: string;
  readonly strategyCapsuleId: string;
  readonly strategyCapsuleVersion: string;
  readonly strategyCapsuleRef: StrategyCapsuleRef;
  readonly envelopeId: DecisionValidityEnvelopeId;
  readonly decisionValidUntil: UtcInstant;
  readonly legs: readonly ExecutionPlanLeg[];
  readonly multiLegCoordination: MultiLegCoordination | null;
  readonly authorizationRefs: ExecutionPlanAuthorizationRefs;
  readonly evidenceRefs: readonly string[];
  readonly status: ExecutionPlanStatus;
  readonly policyVersion: string;
  readonly idempotencyKey: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly aiRecommendedCharacteristics: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialEffect: false;
  readonly authorizesFinancialExecution: false;
};

export type ExecutionPlanStoreSnapshot = {
  readonly plans: readonly ExecutionPlan[];
  readonly transitions: readonly ExecutionPlanTransitionRecord[];
  readonly processedTransitionIds: readonly ExecutionPlanTransitionId[];
};

export type ExecutionPlanFailureCode =
  | 'PLAN_NOT_FOUND'
  | 'CUSTOMER_MISMATCH'
  | 'PLAN_ALREADY_EXISTS'
  | 'INVALID_TRANSITION'
  | 'ENVELOPE_EXPIRED'
  | 'INSTRUMENT_NOT_EXECUTABLE'
  | 'MARKET_STATE_INVALID'
  | 'RISK_APPROVAL_MISSING'
  | 'COMPLIANCE_APPROVAL_MISSING'
  | 'CAPITAL_RESERVATION_MISSING'
  | 'PROVIDER_CAPABILITY_UNAVAILABLE'
  | 'MANDATE_PAUSED'
  | 'STRATEGY_VERSION_MISMATCH'
  | 'PLAN_EXCEEDS_APPROVED_SIZE'
  | 'DUPLICATE_TRANSITION'
  | 'NOT_SIMULATION'
  | 'LIVE_GATE_BLOCKED';

export type ExecutionPlanFailure = {
  readonly code: ExecutionPlanFailureCode;
  readonly message: string;
};

export type CreateExecutionPlanLegInput = {
  readonly legId: string;
  readonly legIndex: number;
  readonly instrumentId: string;
  readonly assetClass: ExecutionAssetClass;
  readonly direction: ExecutionPlanDirection;
  readonly targetQuantityUnits: string;
  readonly targetNotionalMinorUnits: string;
  readonly maximumApprovedQuantityUnits: string;
  readonly maximumApprovedNotionalMinorUnits: string;
  readonly executionCurrency: string;
  readonly constraints: ExecutionPlanConstraints;
  readonly hedgeRole?: string | null;
};

export type CreateExecutionPlanInput = {
  readonly customerId: CustomerId;
  readonly mandateId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly opportunityId: string;
  readonly strategyCapsuleRef: StrategyCapsuleRef;
  readonly envelopeId: DecisionValidityEnvelopeId;
  readonly decisionValidUntil: UtcInstant;
  readonly legs: readonly CreateExecutionPlanLegInput[];
  readonly multiLegCoordination?: MultiLegCoordination | null;
  readonly evidenceRefs: readonly string[];
  readonly idempotencyKey: string;
  readonly aiRecommendedCharacteristics?: readonly string[];
  readonly now: UtcInstant;
};

export type ExecutionPlanValidationPorts = {
  readonly envelopeValid: (envelopeId: DecisionValidityEnvelopeId, now: UtcInstant) => boolean;
  readonly mandateActive: (mandateId: string, customerId: CustomerId) => boolean;
  readonly instrumentExecutable: (instrumentId: string, assetClass: ExecutionAssetClass) => boolean;
  readonly marketStateValid: (instrumentId: string, now: UtcInstant) => boolean;
  readonly riskApproved: (input: {
    readonly executionPlanId: ExecutionPlanId | null;
    readonly customerId: CustomerId;
    readonly workOrderId: EconomicWorkOrderId;
    readonly legs: readonly ExecutionPlanLeg[];
  }) => { readonly approved: boolean; readonly reference: string | null };
  readonly complianceApproved: (input: {
    readonly executionPlanId: ExecutionPlanId | null;
    readonly customerId: CustomerId;
    readonly workOrderId: EconomicWorkOrderId;
    readonly envelopeId: DecisionValidityEnvelopeId;
  }) => { readonly approved: boolean; readonly reference: string | null };
  readonly capitalReserved: (input: {
    readonly executionPlanId: ExecutionPlanId;
    readonly customerId: CustomerId;
    readonly totalNotionalMinorUnits: string;
    readonly currency: string;
  }) => { readonly reserved: boolean; readonly reference: string | null };
  readonly providerCapable: (providerRoute: string, instrumentId: string) => boolean;
  readonly strategyVersionMatches: (
    capsuleRef: StrategyCapsuleRef,
    expectedId: string,
    expectedVersion: string,
  ) => boolean;
  readonly withinApprovedSize: (leg: ExecutionPlanLeg) => boolean;
};

export type TransitionExecutionPlanInput = {
  readonly executionPlanId: ExecutionPlanId;
  readonly customerId: CustomerId;
  readonly targetStatus: ExecutionPlanStatus;
  readonly idempotencyKey: string;
  readonly evidenceRef?: string | null;
  readonly now: UtcInstant;
};
