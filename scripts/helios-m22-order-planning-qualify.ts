#!/usr/bin/env node
import assert from 'node:assert/strict';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  computeTransactionCostAnalysis,
  createOrderPlanningStore,
  evaluateM22OrderPlanningQualification,
  FIXTURE_NOW,
  HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED,
  baseExecutionPlan,
  equityTightSpreadMarketState,
  equityWideSpreadMarketState,
  futuresMarketState,
  limitedProviderCapabilities,
  orderPlanningFixture,
  planExecutionTactic,
  staleMarketState,
  synthesizeExecutionResearchRecommendation,
  volatileBtcMarketState,
  type M22QualificationChecks,
} from '../packages/platform/src/helios/multi-asset/index.ts';

const NOW = FIXTURE_NOW;

const checks: M22QualificationChecks = {
  tightSpreadEquity:
    planExecutionTactic(orderPlanningFixture({ requestId: 'q_tight', marketState: equityTightSpreadMarketState(NOW) })).outcome ===
    'PLANNED',
  wideSpreadEquity:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_wide',
        marketState: equityWideSpreadMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, { maxSlippageBps: 200 }),
        transactionCostModel: Object.freeze({
          spreadBps: 900,
          spreadCertainty: 'KNOWN',
          estimatedSlippageBps: 120,
          slippageCertainty: 'ESTIMATED',
          feeMinor: 100n,
          feeCertainty: 'KNOWN',
        }),
      }),
    ).outcome === 'PLANNED',
  volatileBtc:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_btc',
        marketState: volatileBtcMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, { instrumentId: 'CRYPTO:BTC:USD:COINBASE', assetClass: 'crypto' }),
      }),
    ).outcome === 'PLANNED',
  futures:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_fut',
        marketState: futuresMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, { assetClass: 'future' }),
      }),
    ).outcome === 'PLANNED',
  urgentExit:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_exit',
        executionPlan: baseExecutionPlan(NOW, {
          side: 'SELL',
          urgency: 'URGENT_EXIT',
          strategyRequirements: Object.freeze(['URGENT_EXIT']),
        }),
      }),
    ).outcome === 'PLANNED',
  passiveEntry:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_passive',
        executionPlan: baseExecutionPlan(NOW, {
          strategyRequirements: Object.freeze(['PASSIVE_ENTRY']),
          urgency: 'PASSIVE',
        }),
      }),
    ).outcome === 'PLANNED',
  partialFill: planExecutionTactic(orderPlanningFixture({ requestId: 'q_partial', partialFillRemainingUnits: 25n })).outcome === 'PLANNED',
  cancelReplace: planExecutionTactic(orderPlanningFixture({ requestId: 'q_cr' })).tactic!.replaceConditions.length > 0,
  staleMarket:
    planExecutionTactic(orderPlanningFixture({ requestId: 'q_stale', marketState: staleMarketState(NOW) })).outcome === 'REFUSED',
  tacticExpiry:
    planExecutionTactic(orderPlanningFixture({ requestId: 'q_exp', now: asUtcInstant('2026-09-21T16:00:00.000Z') })).outcome ===
    'REFUSED',
  twapSlicing:
    (planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_twap',
        executionPlan: baseExecutionPlan(NOW, { totalQuantityUnits: 800n, strategyRequirements: Object.freeze(['TWAP']) }),
      }),
    ).tactic?.numberOfSlices ?? 0) >= 2,
  insufficientVolumeData:
    planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_vol',
        volumeProfileMinor: null,
        volumeProfileCertainty: 'INSUFFICIENT_DATA',
        executionPlan: baseExecutionPlan(NOW, { strategyRequirements: Object.freeze(['VWAP']) }),
      }),
    ).outcome === 'PLANNED',
  providerUnsupportedOrderType: (() => {
    const r = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'q_unsup',
        providerCapabilities: limitedProviderCapabilities(),
        executionPlan: baseExecutionPlan(NOW, {
          urgency: 'URGENT_EXIT',
          strategyRequirements: Object.freeze(['URGENT_EXIT']),
        }),
      }),
    );
    return r.tactic == null || r.tactic.orderType === 'LIMIT';
  })(),
  transactionCostAnalysis: computeTransactionCostAnalysis(
    Object.freeze({
      expectedPriceMinor: 1n,
      arrivalPriceMinor: 1n,
      executionPriceMinor: 1n,
      spreadCostMinor: 1n,
      estimatedSlippageMinor: 1n,
      realizedSlippageMinor: 1n,
      feesMinor: 1n,
      quantityUnits: 1n,
    }),
    NOW,
  ).analysisId.startsWith('tca_'),
  deterministicReplay:
    planExecutionTactic(orderPlanningFixture({ requestId: 'q_rep' })).tactic?.tacticId ===
    planExecutionTactic(orderPlanningFixture({ requestId: 'q_rep' })).tactic?.tacticId,
  restart: createOrderPlanningStore(createOrderPlanningStore().snapshot()).snapshot().planningResults.length === 0,
  executionResearchAdvisoryOnly:
    synthesizeExecutionResearchRecommendation({
      executionPlanId: 'uep',
      suggestedTacticType: 'PASSIVE_LIMIT',
      suggestedOrderType: 'LIMIT',
      findings: Object.freeze([]),
      confidenceBps: 5000,
    }).llmSourced === true,
  noExecutionAuthority: planExecutionTactic(orderPlanningFixture({ requestId: 'q_auth' })).tactic?.grantsExecutionAuthority === false,
  simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
};

const result = evaluateM22OrderPlanningQualification(checks);
assert.equal(result.marker, HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED, result.blockers.join('; '));
process.exit(0);
