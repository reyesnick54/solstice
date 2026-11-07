import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type {
  Exec05VenueHealthState,
  OrderUrgencyLevel,
  ProhibitedSoleSelectionReason,
  RoutingDecisionOutcome,
  RoutingScoreComponent,
  RoutingSelectionMode,
} from './taxonomy.ts';
import { EXEC05_SCHEMA } from './taxonomy.ts';
import type { SmartRoutingDecisionId } from './ids.ts';

export type RoutingScoreComponentContribution = {
  readonly component: RoutingScoreComponent;
  readonly contributionBps: number;
  readonly rawValue: string;
  readonly notes: string;
};

/** Venue under consideration with microstructure and execution-quality inputs. */
export type ExecutionVenueCandidate = {
  readonly candidateId: string;
  readonly providerId: string;
  readonly accountId: string;
  readonly venueId: string;
  readonly routeId: string;
  readonly eligible: boolean;
  readonly ineligibleReasons: readonly string[];
  readonly displayedPriceMinorUnits: string;
  readonly availableQuantityUnits: string;
  readonly spreadBps: number;
  readonly depthScore: number;
  readonly expectedFillProbabilityPpm: number;
  readonly historicalFillRatePpm: number;
  readonly latencyMs: number;
  readonly feeBps: number;
  readonly rebateBps: number;
  readonly paymentForOrderFlowBps: number;
  readonly estimatedMarketImpactBps: number;
  readonly expectedSlippageBps: number;
  readonly priceImprovementBps: number;
  readonly volatilityBps: number;
  readonly venueHealth: Exec05VenueHealthState;
  readonly providerHealth: Exec05VenueHealthState;
  readonly commercialPreferenceRank: number;
};

export type DirectedOrderInstruction = {
  readonly directiveId: string;
  readonly requiredVenueId: string;
  readonly requiredProviderId: string | null;
  readonly requiredAccountId: string | null;
  readonly customerDirected: true;
  readonly mandateRef: string;
};

/** Per-candidate transparent implementation-cost decomposition (no opaque ML score). */
export type ExecutionQualityEstimate = {
  readonly candidateId: string;
  readonly expectedImplementationCostBps: number;
  readonly expectedFillProbabilityPpm: number;
  readonly expectedSlippageBps: number;
  readonly estimatedMarketImpactBps: number;
  readonly estimatedAllInSpreadBps: number;
};

export type RoutingScorecard = {
  readonly schema: typeof EXEC05_SCHEMA;
  readonly candidateId: string;
  readonly components: readonly RoutingScoreComponentContribution[];
  readonly expectedImplementationCostBps: number;
  readonly transparencyNote: 'COMPONENTS_ONLY_NO_ML_BLEND';
};

export type SmartRoutingRequest = {
  readonly requestId: string;
  readonly customerId: CustomerId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly instrumentId: string;
  readonly orderAction: 'BUY' | 'SELL';
  readonly orderSizeMinorUnits: string;
  readonly currency: string;
  readonly urgency: OrderUrgencyLevel;
  readonly at: UtcInstant;
  readonly directedInstruction: DirectedOrderInstruction | null;
  readonly candidates: readonly ExecutionVenueCandidate[];
};

export type RoutingDecision = {
  readonly schema: typeof EXEC05_SCHEMA;
  readonly decisionId: SmartRoutingDecisionId;
  readonly requestId: string;
  readonly outcome: RoutingDecisionOutcome;
  readonly selectionMode: RoutingSelectionMode;
  readonly selectedCandidateId: string | null;
  readonly selectedVenueId: string | null;
  readonly selectedProviderId: string | null;
  readonly selectedAccountId: string | null;
  readonly selectedRouteId: string | null;
  readonly scorecard: RoutingScorecard | null;
  readonly qualityEstimate: ExecutionQualityEstimate | null;
  readonly rejectedCandidateIds: readonly string[];
  readonly selectionReason: string;
  readonly prohibitedSoleGuardsApplied: readonly ProhibitedSoleSelectionReason[];
  readonly directedInstructionHonored: boolean;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
  readonly decidedAt: UtcInstant;
};

export type VenuePeriodicMetrics = {
  readonly venueId: string;
  readonly providerId: string;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly fillRatePpm: number;
  readonly priceImprovementBpsMean: number;
  readonly slippageBpsMean: number;
  readonly rejectRatePpm: number;
  readonly latencyMsP95: number;
  readonly cancelRatePpm: number;
  readonly sampleCount: number;
};

/** Engineering route-review artifact; not legal best-execution certification. */
export type BestExecutionEvidence = {
  readonly schema: typeof EXEC05_SCHEMA;
  readonly evidenceId: string;
  readonly reviewPeriodStart: UtcInstant;
  readonly reviewPeriodEnd: UtcInstant;
  readonly venueMetrics: readonly VenuePeriodicMetrics[];
  readonly disclaimer: 'ENGINEERING_EVIDENCE_NOT_LEGAL_BEST_EXECUTION_CERTIFICATION';
  readonly generatedAt: UtcInstant;
};
