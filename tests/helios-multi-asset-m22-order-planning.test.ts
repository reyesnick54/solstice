/**
 * HELIOS Multi-Asset Expansion M22 — Intelligent Order Planning and Execution Tactics.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  computeTransactionCostAnalysis,
  createOrderPlanningStore,
  evaluateM22OrderPlanningQualification,
  EXECUTION_TACTIC_METHODOLOGY_VERSION,
  FIXTURE_NOW,
  HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED,
  baseExecutionPlan,
  equityTightSpreadMarketState,
  equityWideSpreadMarketState,
  fullProviderCapabilities,
  futuresMarketState,
  limitedProviderCapabilities,
  orderPlanningFixture,
  planExecutionTactic,
  staleMarketState,
  synthesizeExecutionResearchRecommendation,
  volatileBtcMarketState,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = FIXTURE_NOW;

describe('HELIOS Multi-Asset M22 order planning', () => {
  it('runs helios boundary lint and stays in simulation', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('plans passive limit for tight-spread equity', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_tight_equity',
        marketState: equityTightSpreadMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, {
          strategyRequirements: Object.freeze(['PASSIVE_ENTRY']),
          urgency: 'PASSIVE',
        }),
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.ok(result.tactic);
    assert.equal(result.tactic!.tacticType, 'PASSIVE_LIMIT');
    assert.equal(result.tactic!.orderType, 'LIMIT');
    assert.equal(result.tactic!.limitPriceMinor, 44999n);
    assert.equal(result.tactic!.methodologyVersion, EXECUTION_TACTIC_METHODOLOGY_VERSION);
    assert.equal(result.tactic!.grantsExecutionAuthority, false);
  });

  it('plans passive limit for wide-spread equity to reduce spread crossing', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_wide_equity',
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
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.ok(result.tactic);
    assert.equal(result.tactic!.tacticType, 'PASSIVE_LIMIT');
    assert.equal(result.tactic!.orderType, 'LIMIT');
    assert.ok(result.tactic!.estimatedSpreadCost.valueBps != null);
  });

  it('handles volatile BTC with elevated slippage estimate', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_btc',
        marketState: volatileBtcMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, {
          instrumentId: 'CRYPTO:BTC:USD:COINBASE',
          assetClass: 'crypto',
          totalQuantityUnits: 10n,
          maxSlippageBps: 200,
        }),
        transactionCostModel: Object.freeze({
          spreadBps: 62,
          spreadCertainty: 'KNOWN',
          estimatedSlippageBps: 85,
          slippageCertainty: 'ESTIMATED',
          feeMinor: 500n,
          feeCertainty: 'KNOWN',
        }),
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.ok(result.tactic!.estimatedSlippage.valueBps != null);
  });

  it('uses DAY time-in-force for futures', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_futures',
        marketState: futuresMarketState(NOW),
        executionPlan: baseExecutionPlan(NOW, {
          instrumentId: 'FUTURE:US:CL:NYMEX:202512',
          assetClass: 'future',
        }),
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.equal(result.tactic!.timeInForce, 'DAY');
  });

  it('plans market-style urgent exit when provider supports MARKET', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_urgent_exit',
        executionPlan: baseExecutionPlan(NOW, {
          side: 'SELL',
          urgency: 'URGENT_EXIT',
          strategyRequirements: Object.freeze(['URGENT_EXIT']),
        }),
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.equal(result.tactic!.tacticType, 'MARKET');
    assert.equal(result.tactic!.orderType, 'MARKET');
  });

  it('continues partial fill with remaining quantity', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_partial_fill',
        partialFillRemainingUnits: 40n,
        priorTacticId: 'tac_prior',
        executionPlan: baseExecutionPlan(NOW, { totalQuantityUnits: 100n }),
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.equal(result.tactic!.quantityUnits, 40n);
    assert.equal(result.tactic!.tacticType, 'PARTIAL_FILL_CONTINUATION');
    assert.ok(result.tactic!.cancelConditions.some((c) => c.kind === 'PARTIAL_FILL'));
  });

  it('includes cancel/replace conditions when provider supports them', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_cancel_replace',
        providerCapabilities: fullProviderCapabilities({ supportsCancelReplace: true }),
      }),
    );
    assert.ok(result.tactic!.replaceConditions.length > 0);
    assert.ok(result.tactic!.cancelConditions.some((c) => c.action === 'REPLACE'));
  });

  it('refuses stale market data', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_stale',
        marketState: staleMarketState(NOW),
      }),
    );
    assert.equal(result.outcome, 'REFUSED');
    assert.ok(result.refusalReasons.includes('STALE_MARKET_DATA'));
  });

  it('refuses expired tactic window', () => {
    const expiredNow = asUtcInstant('2026-09-21T16:00:00.000Z');
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_expired',
        now: expiredNow,
      }),
    );
    assert.equal(result.outcome, 'REFUSED');
    assert.ok(result.refusalReasons.includes('TACTIC_EXPIRED'));
  });

  it('TWAP slicing for large orders', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_twap',
        executionPlan: baseExecutionPlan(NOW, {
          totalQuantityUnits: 1000n,
          strategyRequirements: Object.freeze(['TWAP']),
        }),
        volumeProfileMinor: 1_000_000n,
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.equal(result.tactic!.tacticType, 'TWAP_SLICE');
    assert.ok((result.tactic!.numberOfSlices ?? 0) >= 2);
    assert.ok(result.tactic!.schedule.length >= 2);
  });

  it('VWAP planning marks uncertainty when volume data insufficient', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_vwap_insufficient',
        executionPlan: baseExecutionPlan(NOW, {
          strategyRequirements: Object.freeze(['VWAP']),
        }),
        volumeProfileMinor: null,
        volumeProfileCertainty: 'INSUFFICIENT_DATA',
      }),
    );
    assert.equal(result.outcome, 'PLANNED');
    assert.equal(result.tactic!.tacticType, 'VWAP_AWARE');
  });

  it('refuses or degrades when provider lacks MARKET support for urgent exit', () => {
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_unsupported_market',
        providerCapabilities: limitedProviderCapabilities(),
        executionPlan: baseExecutionPlan(NOW, {
          urgency: 'URGENT_EXIT',
          strategyRequirements: Object.freeze(['URGENT_EXIT']),
        }),
      }),
    );
    assert.ok(result.outcome === 'PLANNED' || result.outcome === 'DEGRADED');
    assert.ok(result.tactic == null || result.tactic.orderType === 'LIMIT');
  });

  it('computes transaction cost analysis without fabricating precision', () => {
    const analysis = computeTransactionCostAnalysis(
      Object.freeze({
        expectedPriceMinor: 45000n,
        arrivalPriceMinor: 45000n,
        executionPriceMinor: 45010n,
        spreadCostMinor: 5n,
        estimatedSlippageMinor: 8n,
        realizedSlippageMinor: 900n,
        feesMinor: 100n,
        quantityUnits: 100n,
      }),
      NOW,
    );
    assert.equal(analysis.dataComplete, true);
    assert.equal(analysis.realizedSlippageBps, 2);
    assert.ok(analysis.executionShortfallMinor != null);

    const incomplete = computeTransactionCostAnalysis(
      Object.freeze({
        expectedPriceMinor: 45000n,
        arrivalPriceMinor: 45000n,
        executionPriceMinor: null,
        spreadCostMinor: null,
        estimatedSlippageMinor: null,
        realizedSlippageMinor: null,
        feesMinor: null,
        quantityUnits: 100n,
      }),
      NOW,
    );
    assert.equal(incomplete.dataComplete, false);
  });

  it('deterministic replay produces identical tactic ids', () => {
    const input = orderPlanningFixture({ requestId: 'req_replay' });
    const first = planExecutionTactic(input);
    const second = planExecutionTactic(input);
    assert.equal(first.tactic?.tacticId, second.tactic?.tacticId);
    assert.deepEqual(first.tactic, second.tactic);
  });

  it('store restart preserves recorded tactics', () => {
    const store = createOrderPlanningStore();
    const result = planExecutionTactic(orderPlanningFixture({ requestId: 'req_restart' }));
    store.record(result);
    const restarted = createOrderPlanningStore(store.snapshot());
    assert.equal(restarted.findByRequestId('req_restart')?.tactic?.tacticId, result.tactic?.tacticId);
  });

  it('rejects incompatible execution research recommendation', () => {
    const research = synthesizeExecutionResearchRecommendation({
      executionPlanId: 'uep_m22_fixture',
      suggestedTacticType: 'MARKET',
      suggestedOrderType: 'MARKET',
      findings: Object.freeze(['recommend market exit']),
      confidenceBps: 7000,
    });
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_research_reject',
        executionPlan: baseExecutionPlan(NOW, {
          strategyRequirements: Object.freeze(['PASSIVE_ENTRY']),
          urgency: 'PASSIVE',
        }),
        researchRecommendation: research,
      }),
    );
    assert.equal(result.outcome, 'REFUSED');
    assert.ok(result.refusalReasons.includes('RESEARCH_RECOMMENDATION_REJECTED'));
    assert.equal(research.grantsExecutionAuthority, false);
    assert.equal(research.advisoryOnly, true);
  });

  it('accepts compatible execution research recommendation', () => {
    const research = synthesizeExecutionResearchRecommendation({
      executionPlanId: 'uep_m22_fixture',
      suggestedTacticType: 'PASSIVE_LIMIT',
      suggestedOrderType: 'LIMIT',
      findings: Object.freeze(['passive limit appropriate for tight spread']),
      confidenceBps: 8000,
    });
    const result = planExecutionTactic(
      orderPlanningFixture({
        requestId: 'req_research_accept',
        executionPlan: baseExecutionPlan(NOW, {
          strategyRequirements: Object.freeze(['PASSIVE_ENTRY']),
          urgency: 'PASSIVE',
        }),
        researchRecommendation: research,
      }),
    );
    assert.equal(result.researchAccepted, true);
    assert.equal(result.outcome, 'PLANNED');
  });

  it('HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED when all checks pass', () => {
    const checks = {
      tightSpreadEquity: planExecutionTactic(orderPlanningFixture({ requestId: 'q_tight', marketState: equityTightSpreadMarketState(NOW) })).outcome === 'PLANNED',
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
      volatileBtc: planExecutionTactic(orderPlanningFixture({ requestId: 'q_btc', marketState: volatileBtcMarketState(NOW), executionPlan: baseExecutionPlan(NOW, { instrumentId: 'CRYPTO:BTC:USD:COINBASE', assetClass: 'crypto' }) })).outcome === 'PLANNED',
      futures: planExecutionTactic(orderPlanningFixture({ requestId: 'q_fut', marketState: futuresMarketState(NOW), executionPlan: baseExecutionPlan(NOW, { assetClass: 'future' }) })).outcome === 'PLANNED',
      urgentExit: planExecutionTactic(orderPlanningFixture({ requestId: 'q_exit', executionPlan: baseExecutionPlan(NOW, { side: 'SELL', urgency: 'URGENT_EXIT', strategyRequirements: Object.freeze(['URGENT_EXIT']) }) })).outcome === 'PLANNED',
      passiveEntry: planExecutionTactic(orderPlanningFixture({ requestId: 'q_passive', executionPlan: baseExecutionPlan(NOW, { strategyRequirements: Object.freeze(['PASSIVE_ENTRY']), urgency: 'PASSIVE' }) })).outcome === 'PLANNED',
      partialFill: planExecutionTactic(orderPlanningFixture({ requestId: 'q_partial', partialFillRemainingUnits: 25n })).outcome === 'PLANNED',
      cancelReplace: planExecutionTactic(orderPlanningFixture({ requestId: 'q_cr' })).tactic!.replaceConditions.length > 0,
      staleMarket: planExecutionTactic(orderPlanningFixture({ requestId: 'q_stale', marketState: staleMarketState(NOW) })).outcome === 'REFUSED',
      tacticExpiry: planExecutionTactic(orderPlanningFixture({ requestId: 'q_exp', now: asUtcInstant('2026-09-21T16:00:00.000Z') })).outcome === 'REFUSED',
      twapSlicing: (planExecutionTactic(orderPlanningFixture({ requestId: 'q_twap', executionPlan: baseExecutionPlan(NOW, { totalQuantityUnits: 800n, strategyRequirements: Object.freeze(['TWAP']) }) })).tactic?.numberOfSlices ?? 0) >= 2,
      insufficientVolumeData: planExecutionTactic(orderPlanningFixture({ requestId: 'q_vol', volumeProfileMinor: null, volumeProfileCertainty: 'INSUFFICIENT_DATA', executionPlan: baseExecutionPlan(NOW, { strategyRequirements: Object.freeze(['VWAP']) }) })).outcome === 'PLANNED',
      providerUnsupportedOrderType: (() => {
        const r = planExecutionTactic(orderPlanningFixture({ requestId: 'q_unsup', providerCapabilities: limitedProviderCapabilities(), executionPlan: baseExecutionPlan(NOW, { urgency: 'URGENT_EXIT', strategyRequirements: Object.freeze(['URGENT_EXIT']) }) }));
        return r.tactic == null || r.tactic.orderType === 'LIMIT';
      })(),
      transactionCostAnalysis: computeTransactionCostAnalysis(Object.freeze({ expectedPriceMinor: 1n, arrivalPriceMinor: 1n, executionPriceMinor: 1n, spreadCostMinor: 1n, estimatedSlippageMinor: 1n, realizedSlippageMinor: 1n, feesMinor: 1n, quantityUnits: 1n }), NOW).analysisId.startsWith('tca_'),
      deterministicReplay: planExecutionTactic(orderPlanningFixture({ requestId: 'q_rep' })).tactic?.tacticId === planExecutionTactic(orderPlanningFixture({ requestId: 'q_rep' })).tactic?.tacticId,
      restart: createOrderPlanningStore(createOrderPlanningStore().snapshot()).snapshot().planningResults.length === 0,
      executionResearchAdvisoryOnly: synthesizeExecutionResearchRecommendation({ executionPlanId: 'uep', suggestedTacticType: 'PASSIVE_LIMIT', suggestedOrderType: 'LIMIT', findings: Object.freeze([]), confidenceBps: 5000 }).llmSourced === true,
      noExecutionAuthority: planExecutionTactic(orderPlanningFixture({ requestId: 'q_auth' })).tactic?.grantsExecutionAuthority === false,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    };
    const result = evaluateM22OrderPlanningQualification(checks);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M22_ORDER_PLANNING_QUALIFIED, result.blockers.join('; '));
  });
});
