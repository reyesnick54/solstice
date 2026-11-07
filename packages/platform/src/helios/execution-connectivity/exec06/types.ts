/**
 * HELIOS EXEC06 — ParentOrder, ChildOrder, ExecutionSchedule, ExecutionAlgorithmState.
 */

import type { CustomerId } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import type { DecisionValidityEnvelopeId } from '../../decision-validity/ids.ts';
import type { MarketState } from '../../multi-asset/market-state-types.ts';
import type {
  AuthoritativeMarketTrust,
  ChildOrderStatus,
  EXEC06_ENGINE_VERSION,
  ExecutionAlgorithmKind,
  ExecutionAlgorithmMode,
  ExecutionAlgorithmViolationCode,
  MarketDataUntrustedPolicy,
  ParentOrderStatus,
} from './taxonomy.ts';
import type { ChildOrderId, ExecutionScheduleId, ParentOrderId } from './ids.ts';

export type AuthorizedLimitConstraints = {
  readonly minLimitPriceMinor: bigint | null;
  readonly maxLimitPriceMinor: bigint | null;
  readonly referenceArrivalPriceMinor: bigint;
};

export type ExecutionTimeHorizon = {
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant;
  readonly sliceIntervalMs: number;
};

export type ExecutionParticipationLimits = {
  /** Mandate/risk participation ceiling in basis points of interval volume. */
  readonly participationCapBps: number;
  readonly mandateParticipationCapBps: number;
  readonly riskParticipationCapBps: number;
};

export type GovernedParentOrderAuthorization = {
  readonly envelopeId: DecisionValidityEnvelopeId;
  readonly authorityReference: string;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

/** Governed parent investment order — quantity and economics are fixed at registration. */
export type ParentOrder = {
  readonly parentOrderId: ParentOrderId;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly authorizedQuantityUnits: bigint;
  readonly quantityScale: number;
  readonly currency: string;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly limitConstraints: AuthorizedLimitConstraints;
  readonly horizon: ExecutionTimeHorizon;
  readonly urgency: 'PASSIVE' | 'NORMAL' | 'HIGH' | 'URGENT_EXIT';
  readonly participation: ExecutionParticipationLimits;
  readonly authorization: GovernedParentOrderAuthorization;
  readonly maxAuthorizedNotionalMinor: bigint;
  readonly status: ParentOrderStatus;
  readonly registeredAt: UtcInstant;
  readonly methodologyVersion: typeof EXEC06_ENGINE_VERSION;
  readonly grantsExecutionAuthority: false;
  readonly governed: true;
};

export type ChildOrder = {
  readonly childOrderId: ChildOrderId;
  readonly parentOrderId: ParentOrderId;
  readonly scheduleId: ExecutionScheduleId;
  readonly sliceIndex: number;
  readonly side: ParentOrder['side'];
  readonly instrumentId: string;
  readonly customerId: CustomerId;
  readonly quantityUnits: bigint;
  readonly limitPriceMinor: bigint | null;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly status: ChildOrderStatus;
  readonly releaseAt: UtcInstant;
  readonly workingAt: UtcInstant | null;
  readonly canceledAt: UtcInstant | null;
  readonly filledQuantityUnits: bigint;
  readonly replacedByChildOrderId: ChildOrderId | null;
  readonly grantsExecutionAuthority: false;
};

export type ExecutionScheduleSlice = {
  readonly sliceIndex: number;
  readonly releaseAt: UtcInstant;
  readonly quantityUnits: bigint;
  readonly targetParticipationBps: number | null;
};

export type ExecutionSchedule = {
  readonly scheduleId: ExecutionScheduleId;
  readonly parentOrderId: ParentOrderId;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly slices: readonly ExecutionScheduleSlice[];
  readonly createdAt: UtcInstant;
  readonly deterministic: true;
};

export type ExecutionAlgorithmState = {
  readonly parentOrderId: ParentOrderId;
  readonly scheduleId: ExecutionScheduleId;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly mode: ExecutionAlgorithmMode;
  readonly filledQuantityUnits: bigint;
  readonly remainingQuantityUnits: bigint;
  readonly scheduledQuantityUnits: bigint;
  readonly workingChildCount: number;
  readonly openChildOrderIds: readonly ChildOrderId[];
  readonly marketDataTrust: AuthoritativeMarketTrust;
  readonly untrustedPolicy: MarketDataUntrustedPolicy;
  readonly updatedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type RegisterParentOrderInput = {
  readonly requestId: string;
  readonly now: UtcInstant;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly authorizedQuantityUnits: bigint;
  readonly quantityScale: number;
  readonly currency: string;
  readonly algorithmKind: ExecutionAlgorithmKind;
  readonly limitConstraints: AuthorizedLimitConstraints;
  readonly horizon: ExecutionTimeHorizon;
  readonly urgency: ParentOrder['urgency'];
  readonly participation: ExecutionParticipationLimits;
  readonly authorization: GovernedParentOrderAuthorization;
  readonly maxAuthorizedNotionalMinor: bigint;
};

export type AlgorithmMarketContext = {
  readonly now: UtcInstant;
  readonly marketState: MarketState;
  readonly authoritativeTrust: AuthoritativeMarketTrust;
  /** Interval traded quantity in instrument units for participation checks. */
  readonly intervalVolumeUnits: bigint;
  /** Optional VWAP profile weights summing to 1.0 in parts-per-ten-thousand. */
  readonly vwapProfileWeightsBps: readonly number[];
};

export type AlgorithmRiskPort = {
  readonly assessParticipation: (input: {
    readonly parent: ParentOrder;
    readonly proposedChildQuantityUnits: bigint;
    readonly intervalVolumeUnits: bigint;
    readonly participationBps: number;
  }) =>
    | { readonly ok: true }
    | { readonly ok: false; readonly code: 'RISK_REFUSED'; readonly reason: string };
};

export type ChildOrderProposal = {
  readonly child: ChildOrder;
  readonly violations: readonly ExecutionAlgorithmViolationCode[];
};

export type RegisterParentResult =
  | { readonly ok: true; readonly parent: ParentOrder; readonly schedule: ExecutionSchedule; readonly state: ExecutionAlgorithmState }
  | { readonly ok: false; readonly code: ExecutionAlgorithmViolationCode; readonly message: string };

export type AlgorithmTickResult = {
  readonly state: ExecutionAlgorithmState;
  readonly releasedChildren: readonly ChildOrder[];
  readonly canceledChildren: readonly ChildOrder[];
  readonly violations: readonly ExecutionAlgorithmViolationCode[];
};

export type ReplaceChildInput = {
  readonly parentOrderId: ParentOrderId;
  readonly childOrderId: ChildOrderId;
  readonly now: UtcInstant;
  readonly newLimitPriceMinor: bigint | null;
  readonly newQuantityUnits: bigint;
  readonly market: AlgorithmMarketContext;
  readonly risk: AlgorithmRiskPort;
};

export type ReplaceChildResult =
  | { readonly ok: true; readonly replaced: ChildOrder; readonly replacement: ChildOrder; readonly state: ExecutionAlgorithmState }
  | { readonly ok: false; readonly code: ExecutionAlgorithmViolationCode; readonly message: string };

export type ApplyFillInput = {
  readonly parentOrderId: ParentOrderId;
  readonly childOrderId: ChildOrderId;
  readonly now: UtcInstant;
  readonly fillQuantityUnits: bigint;
};

export type ExecutionAlgorithmStoreSnapshot = {
  readonly parents: readonly ParentOrder[];
  readonly children: readonly ChildOrder[];
  readonly schedules: readonly ExecutionSchedule[];
  readonly states: readonly ExecutionAlgorithmState[];
};
