/**
 * Provider-neutral bridge from MarketState into HELIOS research systems.
 *
 * Downstream research modules must consume this port — not provider adapters.
 */

import type { MarketState, MarketTradabilityDecision } from './types.ts';
import type { ResearchConsumerSystem, TradabilityState } from './taxonomy.ts';

export type MarketStateResearchView = {
  readonly consumer: ResearchConsumerSystem;
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly venue: string;
  readonly sessionState: MarketState['sessionState'];
  readonly referencePrice: MarketState['referencePrice'];
  readonly bid: MarketState['bid'];
  readonly ask: MarketState['ask'];
  readonly spreadBps: MarketState['spreadBps'];
  readonly recentVolume: MarketState['recentVolume'];
  readonly availableBarTimeframes: MarketState['availableBarTimeframes'];
  readonly latestObservationTimestamp: MarketState['latestObservationTimestamp'];
  readonly freshness: MarketState['freshness'];
  readonly dataQuality: MarketState['dataQuality'];
  readonly volatilityState: MarketState['volatilityState'];
  readonly liquidityState: MarketState['liquidityState'];
  readonly futuresRollState: MarketState['futuresRollState'];
  readonly entitlementState: MarketState['entitlementState'];
  readonly providerHealth: MarketState['providerHealth'];
  readonly executionCapability: MarketState['executionCapability'];
  readonly confidence: MarketState['confidence'];
  readonly evidenceRefs: MarketState['evidenceRefs'];
  readonly tradability: TradabilityState;
  readonly capabilities: MarketTradabilityDecision['capabilities'];
  readonly admitted: boolean;
  readonly admissionReason: string;
};

export type MarketStateBridgeAdmissionPolicy = {
  readonly requireResearchable: boolean;
  readonly requireProposalEligible: boolean;
  readonly requireExecutable: boolean;
  readonly allowedTradability: readonly TradabilityState[];
};

const DEFAULT_ADMISSION: Record<ResearchConsumerSystem, MarketStateBridgeAdmissionPolicy> = Object.freeze({
  OPPORTUNITY_RESEARCH: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: false,
    requireExecutable: false,
    allowedTradability: [
      'TRADABLE',
      'RESEARCH_ONLY',
      'DATA_STALE',
      'MARKET_CLOSED',
      'CONTRACT_EXPIRING',
    ] as const satisfies readonly TradabilityState[],
  }),
  STAT_ARB: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: false,
    requireExecutable: false,
    allowedTradability: ['TRADABLE', 'RESEARCH_ONLY', 'DATA_STALE'] as const satisfies readonly TradabilityState[],
  }),
  VOLATILITY: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: false,
    requireExecutable: false,
    allowedTradability: ['TRADABLE', 'RESEARCH_ONLY', 'DATA_STALE', 'MARKET_CLOSED'] as const satisfies readonly TradabilityState[],
  }),
  MICROSTRUCTURE: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: false,
    requireExecutable: false,
    allowedTradability: ['TRADABLE', 'RESEARCH_ONLY'] as const satisfies readonly TradabilityState[],
  }),
  EXECUTION_RESEARCH: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: true,
    requireExecutable: false,
    allowedTradability: ['TRADABLE', 'EXECUTION_UNAVAILABLE'] as const satisfies readonly TradabilityState[],
  }),
  STRATEGY_LAB: Object.freeze({
    requireResearchable: true,
    requireProposalEligible: false,
    requireExecutable: false,
    allowedTradability: [
      'TRADABLE',
      'RESEARCH_ONLY',
      'DATA_STALE',
      'MARKET_CLOSED',
      'CONTRACT_EXPIRING',
    ] as const satisfies readonly TradabilityState[],
  }),
});

export function bridgeMarketStateToResearch(input: {
  readonly consumer: ResearchConsumerSystem;
  readonly marketState: MarketState;
  readonly tradability: MarketTradabilityDecision;
  readonly policy?: MarketStateBridgeAdmissionPolicy;
}): MarketStateResearchView {
  const policy = input.policy ?? DEFAULT_ADMISSION[input.consumer];
  const admission = evaluateAdmission(input.tradability, policy);
  return Object.freeze({
    consumer: input.consumer,
    instrumentId: input.marketState.instrumentId,
    assetClass: input.marketState.assetClass,
    venue: input.marketState.venue,
    sessionState: input.marketState.sessionState,
    referencePrice: input.marketState.referencePrice,
    bid: input.marketState.bid,
    ask: input.marketState.ask,
    spreadBps: input.marketState.spreadBps,
    recentVolume: input.marketState.recentVolume,
    availableBarTimeframes: input.marketState.availableBarTimeframes,
    latestObservationTimestamp: input.marketState.latestObservationTimestamp,
    freshness: input.marketState.freshness,
    dataQuality: input.marketState.dataQuality,
    volatilityState: input.marketState.volatilityState,
    liquidityState: input.marketState.liquidityState,
    futuresRollState: input.marketState.futuresRollState,
    entitlementState: input.marketState.entitlementState,
    providerHealth: input.marketState.providerHealth,
    executionCapability: input.marketState.executionCapability,
    confidence: input.marketState.confidence,
    evidenceRefs: input.marketState.evidenceRefs,
    tradability: input.tradability.tradability,
    capabilities: input.tradability.capabilities,
    admitted: admission.admitted,
    admissionReason: admission.reason,
  });
}

function evaluateAdmission(
  tradability: MarketTradabilityDecision,
  policy: MarketStateBridgeAdmissionPolicy,
): { readonly admitted: boolean; readonly reason: string } {
  if (policy.requireResearchable && !tradability.capabilities.researchable) {
    return Object.freeze({ admitted: false, reason: 'not researchable' });
  }
  if (policy.requireProposalEligible && !tradability.capabilities.proposalEligible) {
    return Object.freeze({ admitted: false, reason: 'not proposal eligible' });
  }
  if (policy.requireExecutable && !tradability.capabilities.executable) {
    return Object.freeze({ admitted: false, reason: 'not executable' });
  }
  if (!policy.allowedTradability.includes(tradability.tradability)) {
    return Object.freeze({ admitted: false, reason: `tradability ${tradability.tradability} not allowed` });
  }
  return Object.freeze({ admitted: true, reason: 'admitted' });
}

export function bridgeMarketStateToAllResearch(input: {
  readonly marketState: MarketState;
  readonly tradability: MarketTradabilityDecision;
}): Readonly<Record<ResearchConsumerSystem, MarketStateResearchView>> {
  return Object.freeze({
    OPPORTUNITY_RESEARCH: bridgeMarketStateToResearch({ consumer: 'OPPORTUNITY_RESEARCH', ...input }),
    STAT_ARB: bridgeMarketStateToResearch({ consumer: 'STAT_ARB', ...input }),
    VOLATILITY: bridgeMarketStateToResearch({ consumer: 'VOLATILITY', ...input }),
    MICROSTRUCTURE: bridgeMarketStateToResearch({ consumer: 'MICROSTRUCTURE', ...input }),
    EXECUTION_RESEARCH: bridgeMarketStateToResearch({ consumer: 'EXECUTION_RESEARCH', ...input }),
    STRATEGY_LAB: bridgeMarketStateToResearch({ consumer: 'STRATEGY_LAB', ...input }),
  });
}

export { DEFAULT_ADMISSION };
