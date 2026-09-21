import { asCustomerId, asUtcInstant, type UtcInstant } from '@solstice/domain';
import { asDecisionValidityEnvelopeId } from '../../decision-validity/ids.ts';
import type { DecisionValidityEnvelope } from '../../decision-validity/types.ts';
import {
  asExecutableOpportunityId,
  asOpportunityCandidateId,
} from '../../executable-opportunity/ids.ts';
import { asEconomicWorkOrderId } from '../../ids.ts';
import type { MarketState } from '../market-state-types.ts';
import type { UniversalExecutionPlan } from '../m21/types.ts';
import { UNIVERSAL_EXECUTION_PLAN_VERSION } from '../m21/types.ts';
import type {
  CustomerRiskConstraints,
  OrderPlanningInput,
  ProviderOrderCapabilities,
  TransactionCostModel,
} from './types.ts';

export const FIXTURE_NOW = asUtcInstant('2026-09-21T14:30:00.000Z');

function baseEnvelope(now: UtcInstant, validUntil: UtcInstant): DecisionValidityEnvelope {
  return Object.freeze({
    envelopeId: asDecisionValidityEnvelopeId('dve_m22_fixture'),
    candidateId: asOpportunityCandidateId('opc_m22'),
    executableOpportunityId: asExecutableOpportunityId('xop_m22'),
    strategyCapsuleRef: Object.freeze({ strategyId: 'strat_m22', version: 'v1', hash: 'hash_m22' }),
    strategyCapsuleHash: 'hash_m22',
    workOrderId: asEconomicWorkOrderId('ewo_m22'),
    customerId: asCustomerId('cust_m22'),
    accountId: 'acct_m22',
    proposedActionRef: 'action_m22',
    metaAllocatorRecommendationId: 'mar_m22',
    createdAt: now,
    evaluatedAt: now,
    validUntil,
    policyVersion: 'decision-validity-v1',
    componentChecks: Object.freeze([]),
    overallStatus: 'VALID',
    failureAction: null,
    reasonCodes: Object.freeze([]),
    evidenceRefs: Object.freeze(['env_evidence_1']),
    latencyMarkers: Object.freeze({
      evidenceArrivedAt: now,
      candidateDiscoveredAt: now,
      researchCompletedAt: now,
      qualificationAt: now,
      envelopeEvaluatedAt: now,
      proposalReadyAt: now,
    }),
    revision: 1,
    supersedesEnvelopeId: null,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
  });
}

function quote(minorUnits: string) {
  return Object.freeze({ minorUnits, currency: 'USD', scale: 2 });
}

export function equityTightSpreadMarketState(now: UtcInstant): MarketState {
  return Object.freeze({
    instrumentId: 'SECURITY:US:SPY:ARCX',
    assetClass: 'equity',
    venue: 'ARCX',
    sessionState: 'OPEN',
    referencePrice: quote('45000'),
    bid: quote('44999'),
    ask: quote('45001'),
    spread: quote('2'),
    spreadBps: 4,
    recentVolume: '5000000',
    availableBarTimeframes: Object.freeze(['1m', '5m'] as const),
    latestObservationTimestamp: now,
    freshness: 'FRESH',
    dataQuality: Object.freeze({
      state: 'USABLE',
      dimensions: Object.freeze({
        freshness: 'PASS',
        completeness: 'PASS',
        providerHealth: 'PASS',
        entitlement: 'PASS',
        timestampConsistency: 'PASS',
        spreadSanity: 'PASS',
        corroboration: 'PASS',
      }),
      flags: Object.freeze([]),
    }),
    volatilityState: 'NORMAL',
    liquidityState: 'ADEQUATE',
    futuresRollState: 'NOT_APPLICABLE',
    entitlementState: 'USABLE',
    providerHealth: 'HEALTHY',
    executionCapability: 'AVAILABLE',
    confidence: 'HIGH',
    evidenceRefs: Object.freeze([Object.freeze({ refType: 'quote', refId: 'q1' })]),
    evaluatedAt: now,
  });
}

export function equityWideSpreadMarketState(now: UtcInstant): MarketState {
  const base = equityTightSpreadMarketState(now);
  return Object.freeze({
    ...base,
    instrumentId: 'SECURITY:US:ILLIQ:XNYS',
    bid: quote('1000'),
    ask: quote('1090'),
    spread: quote('90'),
    spreadBps: 900,
    liquidityState: 'THIN',
  });
}

export function volatileBtcMarketState(now: UtcInstant): MarketState {
  return Object.freeze({
    instrumentId: 'CRYPTO:BTC:USD:COINBASE',
    assetClass: 'crypto',
    venue: 'COINBASE',
    sessionState: 'OPEN',
    referencePrice: quote('6500000'),
    bid: quote('6498000'),
    ask: quote('6502000'),
    spread: quote('4000'),
    spreadBps: 62,
    recentVolume: '1200',
    availableBarTimeframes: Object.freeze(['1m'] as const),
    latestObservationTimestamp: now,
    freshness: 'FRESH',
    dataQuality: Object.freeze({
      state: 'USABLE',
      dimensions: Object.freeze({
        freshness: 'PASS',
        completeness: 'PASS',
        providerHealth: 'PASS',
        entitlement: 'PASS',
        timestampConsistency: 'PASS',
        spreadSanity: 'PASS',
        corroboration: 'PASS',
      }),
      flags: Object.freeze([]),
    }),
    volatilityState: 'ELEVATED',
    liquidityState: 'ADEQUATE',
    futuresRollState: 'NOT_APPLICABLE',
    entitlementState: 'USABLE',
    providerHealth: 'HEALTHY',
    executionCapability: 'AVAILABLE',
    confidence: 'MEDIUM',
    evidenceRefs: Object.freeze([Object.freeze({ refType: 'quote', refId: 'btc_q1' })]),
    evaluatedAt: now,
  });
}

export function futuresMarketState(now: UtcInstant): MarketState {
  const base = equityTightSpreadMarketState(now);
  return Object.freeze({
    ...base,
    instrumentId: 'FUTURE:US:CL:NYMEX:202512',
    assetClass: 'future',
    spreadBps: 12,
    futuresRollState: 'FRONT_MONTH',
  });
}

export function staleMarketState(now: UtcInstant): MarketState {
  const base = equityTightSpreadMarketState(now);
  return Object.freeze({
    ...base,
    freshness: 'STALE',
    dataQuality: Object.freeze({
      ...base.dataQuality,
      state: 'UNUSABLE',
      dimensions: Object.freeze({ ...base.dataQuality.dimensions, freshness: 'FAIL' }),
      flags: Object.freeze(['STALE_QUOTE']),
    }),
  });
}

export function fullProviderCapabilities(overrides: Partial<ProviderOrderCapabilities> = {}): ProviderOrderCapabilities {
  return Object.freeze({
    providerId: 'fixture_broker',
    routeId: 'route_fixture_eq',
    supportedOrderTypes: Object.freeze(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] as const),
    supportedTimeInForce: Object.freeze(['DAY', 'GTC', 'IOC', 'FOK'] as const),
    supportsCancelReplace: true,
    supportsPartialFill: true,
    minimumQuantityUnits: 1n,
    lotSizeUnits: 1n,
    commissionMinor: 100n,
    commissionCertainty: 'KNOWN',
    ...overrides,
  });
}

export function limitedProviderCapabilities(): ProviderOrderCapabilities {
  return fullProviderCapabilities({
    supportedOrderTypes: Object.freeze(['LIMIT'] as const),
    supportedTimeInForce: Object.freeze(['DAY'] as const),
    supportsCancelReplace: false,
    commissionMinor: null,
    commissionCertainty: 'INSUFFICIENT_DATA',
  });
}

export function baseTransactionCostModel(overrides: Partial<TransactionCostModel> = {}): TransactionCostModel {
  return Object.freeze({
    spreadBps: 8,
    spreadCertainty: 'KNOWN',
    estimatedSlippageBps: 5,
    slippageCertainty: 'ESTIMATED',
    feeMinor: 100n,
    feeCertainty: 'KNOWN',
    ...overrides,
  });
}

export function baseCustomerConstraints(
  overrides: Partial<CustomerRiskConstraints> = {},
): CustomerRiskConstraints {
  return Object.freeze({
    availableCapitalMinor: 1_000_000n,
    maxNotionalMinor: null,
    exitOnly: false,
    blockNewEntries: false,
    ...overrides,
  });
}

export function baseExecutionPlan(
  now: UtcInstant,
  overrides: Partial<UniversalExecutionPlan> = {},
): UniversalExecutionPlan {
  const validUntil = asUtcInstant('2026-09-21T15:30:00.000Z');
  return Object.freeze({
    executionPlanId: 'uep_m22_fixture',
    configVersion: UNIVERSAL_EXECUTION_PLAN_VERSION,
    envelopeId: asDecisionValidityEnvelopeId('dve_m22_fixture'),
    instrumentId: 'SECURITY:US:SPY:ARCX',
    assetClass: 'equity',
    side: 'BUY',
    totalQuantityUnits: 100n,
    quantityScale: 0,
    currency: 'USD',
    urgency: 'NORMAL',
    strategyRequirements: Object.freeze(['MINIMIZE_IMPACT'] as const),
    maxSlippageBps: 50,
    maxParticipationRateBps: 1500,
    arrivalPriceMinor: 45000n,
    validFrom: now,
    validUntil,
    routeId: 'route_fixture_eq',
    providerId: 'fixture_broker',
    evidenceRefs: Object.freeze(['plan_evidence_1']),
    grantsExecutionAuthority: false,
    deterministic: true,
    ...overrides,
  });
}

export function orderPlanningFixture(
  overrides: Partial<OrderPlanningInput> & { readonly now?: UtcInstant } = {},
): OrderPlanningInput {
  const now = overrides.now ?? FIXTURE_NOW;
  const validUntil = asUtcInstant('2026-09-21T15:30:00.000Z');
  const plan = overrides.executionPlan ?? baseExecutionPlan(now);
  return Object.freeze({
    requestId: overrides.requestId ?? 'req_m22_fixture',
    now,
    executionPlan: plan,
    envelope: overrides.envelope ?? baseEnvelope(now, validUntil),
    marketState: overrides.marketState ?? equityTightSpreadMarketState(now),
    providerCapabilities: overrides.providerCapabilities ?? fullProviderCapabilities(),
    transactionCostModel: overrides.transactionCostModel ?? baseTransactionCostModel(),
    customerConstraints: overrides.customerConstraints ?? baseCustomerConstraints(),
    volumeProfileMinor: overrides.volumeProfileMinor ?? 10_000_000n,
    volumeProfileCertainty: overrides.volumeProfileCertainty ?? 'KNOWN',
    researchRecommendation: overrides.researchRecommendation ?? null,
    partialFillRemainingUnits: overrides.partialFillRemainingUnits ?? null,
    priorTacticId: overrides.priorTacticId ?? null,
  });
}
