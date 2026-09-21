/**
 * HELIOS Multi-Asset Expansion M28 — M01–M27 qualification registry.
 * Maps milestone IDs to canonical owners and expected qualification markers.
 */

import type { M28MilestoneId, M28MilestoneQualificationState } from './taxonomy.ts';

export type M28MilestoneRecord = {
  readonly milestoneId: M28MilestoneId;
  readonly title: string;
  readonly canonicalOwner: string;
  readonly qualificationMarker: string | null;
  readonly state: M28MilestoneQualificationState;
  readonly testRefs: readonly string[];
  readonly notes: readonly string[];
};

export type M28MilestoneRegistry = {
  readonly milestones: readonly M28MilestoneRecord[];
  readonly qualifiedCount: number;
  readonly partialCount: number;
  readonly blockedCount: number;
};

const MILESTONE_DEFINITIONS: readonly Omit<M28MilestoneRecord, 'state'>[] = Object.freeze([
  {
    milestoneId: 'M01',
    title: 'Canonical multi-asset instrument identities',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/m01/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-m01-multi-asset-instrument.test.ts']),
    notes: Object.freeze(['Qualified via M04 market-state integration']),
  },
  {
    milestoneId: 'M02',
    title: 'Market observations',
    canonicalOwner: 'packages/platform/src/helios/market-observation/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M02_MARKET_OBSERVATIONS_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m02-market-observations.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M03',
    title: 'Market calendars and session contracts',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/market-calendar/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M03_MARKET_CALENDAR_CONTRACTS_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m03-market-calendar-contracts.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M04',
    title: 'Canonical MarketState and tradability',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M04_MARKET_STATE_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-m04-multi-asset-market-state.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M05',
    title: 'Equity/index market data',
    canonicalOwner: 'packages/sunrey-exchange/src/capital-market/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-m05-equity-index-data.test.ts']),
    notes: Object.freeze(['SPY/QQQ adapter-ready; live credentials optional']),
  },
  {
    milestoneId: 'M06',
    title: 'Crypto spot market data',
    canonicalOwner: 'packages/sunrey-exchange/src/crypto-market/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-m06-crypto-market-data.test.ts']),
    notes: Object.freeze(['BTC/ETH simulation adapters; no live execution']),
  },
  {
    milestoneId: 'M07',
    title: 'Gold market data',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/gold/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M07_GOLD_MARKET_DATA_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-m07-gold-market-data.test.ts']),
    notes: Object.freeze(['Simulation registry only — no live gold feed']),
  },
  {
    milestoneId: 'M08',
    title: 'WTI energy market data',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/energy/wti/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M08_WTI_ENERGY_DATA_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m08-wti-energy.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M09',
    title: 'Index mean reversion strategy',
    canonicalOwner: 'packages/strategy-lab/src/m09/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m09-index-mean-reversion.test.ts']),
    notes: Object.freeze(['Strategy Lab qualified; not yet dispatched in paper runtime']),
  },
  {
    milestoneId: 'M10',
    title: 'Crypto momentum breakout strategy',
    canonicalOwner: 'packages/strategy-lab/src/crypto-momentum/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m10-crypto-momentum-breakout.test.ts']),
    notes: Object.freeze(['Strategy Lab qualified; not yet dispatched in paper runtime']),
  },
  {
    milestoneId: 'M11',
    title: 'Commodity trend following strategy',
    canonicalOwner: 'packages/strategy-lab/src/commodity-trend/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m11-commodity-trend-following.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M12',
    title: 'Relative value / stat arb strategy',
    canonicalOwner: 'packages/strategy-lab/src/relative-value/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m12-relative-value-stat-arb.test.ts']),
    notes: Object.freeze(['Multi-leg not yet dispatched in paper runtime']),
  },
  {
    milestoneId: 'M13',
    title: 'Cross-asset regime engine',
    canonicalOwner: 'packages/platform/src/helios/intelligence/m13-regime/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m13-regime-engine.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M14',
    title: 'Macro and event intelligence fabric',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/event-intelligence/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M14_MACRO_EVENT_INTELLIGENCE_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m14-macro-event-intelligence.test.ts']),
    notes: Object.freeze(['Parallel M14 opportunity graph in intelligence/m14-opportunity-graph/']),
  },
  {
    milestoneId: 'M15',
    title: 'Cross-asset opportunity graph',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/m15/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m15-cross-asset-graph.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M16',
    title: 'Opportunity ranking engine',
    canonicalOwner: 'packages/platform/src/helios/intelligence/m16-opportunity-ranking/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m16-opportunity-ranking.test.ts']),
    notes: Object.freeze(['Ranking store in-memory; durable PG persistence pending']),
  },
  {
    milestoneId: 'M17',
    title: 'Dynamic cross-asset correlation',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/correlation/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M17_DYNAMIC_CORRELATION_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m17-dynamic-correlation.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M18',
    title: 'Portfolio exposure graph',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/m18/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M18_PORTFOLIO_EXPOSURE_GRAPH_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m18-portfolio-exposure-graph.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M19',
    title: 'Dynamic position sizing boundary',
    canonicalOwner: 'packages/platform/src/helios/meta-allocator/position-sizing/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m19-dynamic-position-sizing.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M20',
    title: 'Portfolio drawdown and kill controls',
    canonicalOwner: 'packages/risk/src/portfolio/',
    qualificationMarker: 'HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED',
    testRefs: Object.freeze(['tests/helios-multi-asset-m20-portfolio-risk-controls.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M21',
    title: 'Decision-validity envelope and execution planning',
    canonicalOwner: 'packages/platform/src/helios/decision-validity/',
    qualificationMarker: 'HELIOS_H21_DECISION_VALIDITY_ENVELOPE',
    testRefs: Object.freeze(['tests/helios-h21-decision-validity-envelope.test.ts']),
    notes: Object.freeze(['Execution layer; extends H21 canonical owner']),
  },
  {
    milestoneId: 'M22',
    title: 'Provider orchestration and routing',
    canonicalOwner: 'packages/platform/src/helios/provider-orchestration/',
    qualificationMarker: 'HELIOS_H22_PROVIDER_ORCHESTRATION',
    testRefs: Object.freeze(['tests/helios-h22-provider-orchestration.test.ts']),
    notes: Object.freeze(['External provider certification pending']),
  },
  {
    milestoneId: 'M23',
    title: 'Order fill settlement lifecycle',
    canonicalOwner: 'packages/platform/src/helios/order-lifecycle/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-h23-order-fill-settlement-lifecycle.test.ts']),
    notes: Object.freeze(['Paper simulation only']),
  },
  {
    milestoneId: 'M24',
    title: 'Capital lifecycle and cash availability',
    canonicalOwner: 'packages/platform/src/helios/capital-lifecycle/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-h24-capital-lifecycle.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M25',
    title: 'Outcome attribution and reconciliation',
    canonicalOwner: 'packages/platform/src/helios/outcome-attribution/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-h25-outcome-attribution.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M26',
    title: 'Production-shaped Grow API contract',
    canonicalOwner: 'services/api/src/consumer/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-h26-production-shaped-grow-api.test.ts']),
    notes: Object.freeze([]),
  },
  {
    milestoneId: 'M27',
    title: 'Grow operational controls and autonomy boundaries',
    canonicalOwner: 'packages/platform/src/helios/grow-controls/',
    qualificationMarker: 'HELIOS_GROW_PRODUCT_CONTRACT_QUALIFIED',
    testRefs: Object.freeze([
      'tests/helios-h27-grow-operational-controls.test.ts',
      'tests/helios-h15-paper-grow-restart.test.ts',
    ]),
    notes: Object.freeze(['Continuous runtime and restart recovery via H06/H15']),
  },
  {
    milestoneId: 'M28',
    title: 'Forward-paper release candidate qualification',
    canonicalOwner: 'packages/platform/src/helios/multi-asset/release-candidate/',
    qualificationMarker: null,
    testRefs: Object.freeze(['tests/helios-multi-asset-m28-release-qualification.test.ts']),
    notes: Object.freeze(['Final program milestone']),
  },
]);

export function buildM28MilestoneRegistry(input: {
  readonly testResults: Readonly<Record<string, boolean>>;
}): M28MilestoneRegistry {
  const milestones: M28MilestoneRecord[] = [];

  for (const def of MILESTONE_DEFINITIONS) {
    if (def.milestoneId === 'M28') {
      milestones.push(Object.freeze({ ...def, state: 'NOT_STARTED' }));
      continue;
    }

    const testOutcomes = def.testRefs.map((ref) => input.testResults[ref] ?? false);
    const allPassed = testOutcomes.length > 0 && testOutcomes.every(Boolean);
    const anyPassed = testOutcomes.some(Boolean);

    let state: M28MilestoneQualificationState;
    if (allPassed) {
      state = def.notes.some((n) => n.includes('not yet') || n.includes('pending') || n.includes('simulation only'))
        ? 'PARTIAL'
        : 'QUALIFIED';
    } else if (anyPassed) {
      state = 'PARTIAL';
    } else if (def.qualificationMarker == null && def.milestoneId === 'M01') {
      state = input.testResults['tests/helios-m04-multi-asset-market-state.test.ts'] ? 'QUALIFIED' : 'BLOCKED';
    } else {
      state = 'BLOCKED';
    }

    milestones.push(Object.freeze({ ...def, state }));
  }

  return Object.freeze({
    milestones: Object.freeze(milestones),
    qualifiedCount: milestones.filter((m) => m.state === 'QUALIFIED').length,
    partialCount: milestones.filter((m) => m.state === 'PARTIAL').length,
    blockedCount: milestones.filter((m) => m.state === 'BLOCKED').length,
  });
}
