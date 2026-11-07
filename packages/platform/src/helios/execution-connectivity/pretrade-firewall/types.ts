import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { DecisionValidityEnvelopeId } from '../../decision-validity/ids.ts';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type {
  PreTradeExecutionOutcome,
  PreTradeExecutionReasonCode,
  PRE_TRADE_FIREWALL_POLICY_VERSION,
} from './taxonomy.ts';

export type CreditCapitalLimitVector = {
  readonly maxOrderNotionalMinor: bigint;
  readonly maxOrderQuantity: bigint;
  readonly maxParticipationRateBps: bigint;
  readonly availableBuyingPowerMinor: bigint;
};

export type PreTradeStructuredProductPosture = {
  readonly shortSaleGoverned: boolean;
  readonly shortSaleExternallyEnabled: boolean;
  readonly marginLeverageGoverned: boolean;
  readonly marginLeverageExternallyEnabled: boolean;
  readonly derivativesGoverned: boolean;
  readonly derivativesExternallyEnabled: boolean;
  readonly nakedOptionsGoverned: boolean;
  readonly nakedOptionsExternallyEnabled: boolean;
  readonly uncoveredBorrowingGoverned: boolean;
  readonly uncoveredBorrowingExternallyEnabled: boolean;
};

export type PreTradeOrderShape = {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly side: 'BUY' | 'SELL';
  readonly positionEffect: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'UNKNOWN';
  readonly orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  readonly quantityUnits: bigint;
  readonly notionalMinorUnits: bigint;
  readonly limitPriceMinorUnits: bigint | null;
  readonly currency: string;
  readonly instrumentId: string;
  readonly instrumentAssetClass: string;
  readonly instrumentDerivativeKind: 'NONE' | 'OPTION' | 'FUTURE' | 'SWAP' | 'UNSUPPORTED';
  readonly optionCoverage: 'COVERED' | 'NAKED' | 'NOT_APPLICABLE';
  readonly marginLeverageRequested: boolean;
  readonly borrowedSharesRequired: boolean;
  readonly borrowingCovered: boolean;
  readonly restrictedSecurity: boolean;
};

export type PreTradeMarketDataFacts = {
  readonly authoritative: boolean;
  readonly fresh: boolean;
  readonly referencePriceMinor: bigint | null;
  readonly observedAt: UtcInstant | null;
};

export type PreTradeRiskEngineSnapshot = {
  readonly consulted: boolean;
  readonly outcome: 'ALLOW_SIMULATION' | 'REQUIRE_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA' | null;
  readonly reasonCodes: readonly string[];
  readonly triggeredLimitIds: readonly string[];
};

export type PreTradeExecutionRequest = {
  readonly requestId: string;
  readonly evaluatedAt: UtcInstant;
  readonly customerId: CustomerId;
  readonly accountId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly proposalId: string;
  readonly envelopeId: DecisionValidityEnvelopeId | null;
  readonly providerRoute: string;
  readonly environment: 'SIMULATION' | 'SANDBOX' | 'PAPER';
  readonly jurisdiction: string;
  readonly marketAccess: {
    readonly allowed: boolean;
    readonly reasonCodes: readonly string[];
  };
  readonly order: PreTradeOrderShape;
  readonly marketData: PreTradeMarketDataFacts;
  readonly marketSessionOpen: boolean;
  readonly instrumentEligible: boolean;
  readonly customerOwnsAccount: boolean;
  readonly mandateActive: boolean;
  readonly envelopeValid: boolean;
  readonly kernelAuthorized: boolean;
  readonly capitalReserved: boolean;
  readonly capitalReservationId: string | null;
  readonly sunreyLimits: CreditCapitalLimitVector;
  readonly brokerLimits: CreditCapitalLimitVector | null;
  readonly sunreyRisk: PreTradeRiskEngineSnapshot;
  readonly brokerPreTradeRejection: { readonly rejected: boolean; readonly reasonCodes: readonly string[] } | null;
  readonly dailyLossBreached: boolean;
  readonly dailyLossReviewBand: boolean;
  readonly strategyContributionBreached: boolean;
  readonly duplicateOrderDetected: boolean;
  readonly participationRateBps: bigint;
  readonly liquidityConstraintViolated: boolean;
  readonly priceCollarBps: bigint;
  readonly fatFingerThresholdBps: bigint;
  readonly structuredProductPosture: PreTradeStructuredProductPosture;
  readonly simulationOnly: true;
  readonly liveGatesEnabled: false;
};

export type PreTradeExecutionDecision = {
  readonly decisionId: string;
  readonly requestId: string;
  readonly outcome: PreTradeExecutionOutcome;
  readonly reasonCodes: readonly PreTradeExecutionReasonCode[];
  readonly policyVersion: typeof PRE_TRADE_FIREWALL_POLICY_VERSION;
  readonly evaluatedAt: UtcInstant;
  readonly effectiveLimits: CreditCapitalLimitVector;
  readonly limitingSource: 'SUNREY' | 'BROKER' | 'BOTH' | 'NONE';
  readonly brokerAuthoritativeRejection: boolean;
  readonly grantsSubmissionEligibility: boolean;
};
