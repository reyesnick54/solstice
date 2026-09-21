#!/usr/bin/env node
/**
 * HELIOS M15 cross-asset opportunity graph qualification harness.
 */

import assert from 'node:assert/strict';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  anchorNodeIdForInstrument,
  bridgeCrossAssetGraphToOpportunityResearch,
  buildCrossAssetOpportunityGraph,
  evaluateMultiAssetM15Qualification,
  HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED,
  InMemoryCrossAssetGraphStore,
  queryCrossAssetOpportunityGraph,
  type CrossAssetGraphBuildInput,
  type CrossAssetInstrumentInput,
  type MarketState,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { resolveMultiAssetInstrument } from '../packages/sunrey-exchange/src/capital-market/multi-asset/index.ts';

const NOW = asUtcInstant('2026-09-16T14:00:00.000Z');
const EXPIRED_AT = asUtcInstant('2026-09-15T00:00:00.000Z');
const SPY = 'SECURITY:US:SPY:ARCX';
const QQQ = 'SECURITY:US:QQQ:XNAS';
const BTC = 'CRYPTO:GLOBAL:BTC:USD:SIM';
const ETH = 'CRYPTO:GLOBAL:ETH:USD:SIM';
const GOLD = 'COMMODITY:GLOBAL:GOLD:XCEC';
const WTI = 'COMMODITY:GLOBAL:WTI:XNYM';
const GLD = 'SECURITY:US:GLD:ARCX';

function toInstrumentInput(instrumentId: string): CrossAssetInstrumentInput {
  const row = resolveMultiAssetInstrument(instrumentId);
  if (!row) {
    throw new Error(`missing instrument ${instrumentId}`);
  }
  return Object.freeze({
    instrumentId: row.instrumentId,
    symbol: row.symbol,
    assetClass: row.assetClass,
    currency: row.settlementCurrency,
    underlyingInstrumentId: row.underlyingInstrumentId,
    proxyForInstrumentId: instrumentId === GLD ? GOLD : null,
  });
}

function correlatedCloses(base: bigint, steps: number, drift = 10n): readonly bigint[] {
  const out: bigint[] = [];
  let value = base;
  for (let i = 0; i < steps; i += 1) {
    out.push(value);
    value += drift + BigInt(i % 3);
  }
  return Object.freeze(out);
}

function timestamps(start: string, count: number) {
  const base = Date.parse(start);
  return Object.freeze(
    Array.from({ length: count }, (_, idx) => asUtcInstant(new Date(base + idx * 3_600_000).toISOString())),
  );
}

function degradedMarketState(instrumentId: string): MarketState {
  return Object.freeze({
    instrumentId,
    assetClass: 'ETF',
    venue: 'ARCX',
    sessionState: 'OPEN',
    referencePrice: Object.freeze({ minorUnits: '10000', currency: 'USD', scale: 2 }),
    bid: null,
    ask: null,
    spread: null,
    spreadBps: null,
    recentVolume: null,
    availableBarTimeframes: Object.freeze(['1m']),
    latestObservationTimestamp: NOW,
    freshness: 'STALE',
    dataQuality: Object.freeze({
      state: 'UNUSABLE',
      dimensions: Object.freeze({
        completeness: 'FAIL',
        freshness: 'FAIL',
        timestampConsistency: 'PASS',
        entitlement: 'PASS',
        providerHealth: 'WARN',
        spreadSanity: 'PASS',
        corroboration: 'PASS',
      }),
      flags: Object.freeze(['DATA_STALE']),
    }),
    volatilityState: 'ELEVATED',
    liquidityState: 'NORMAL',
    futuresRollState: 'NOT_APPLICABLE',
    entitlementState: 'USABLE',
    providerHealth: 'OUTAGE',
    executionCapability: 'UNAVAILABLE',
    confidence: 'LOW',
    evidenceRefs: Object.freeze([Object.freeze({ refType: 'quote' as const, refId: 'fixture_market:SPY' })]),
    evaluatedAt: NOW,
  });
}

function buildInput(): CrossAssetGraphBuildInput {
  const ts = timestamps('2026-09-01T00:00:00.000Z', 24);
  return Object.freeze({
    instruments: Object.freeze([SPY, QQQ, BTC, ETH, GOLD, WTI, GLD].map(toInstrumentInput)),
    barSeries: Object.freeze([
      Object.freeze({ instrumentId: SPY, closes: correlatedCloses(10_000n, 24), timestamps: ts, providerId: 'fixture_market' }),
      Object.freeze({ instrumentId: QQQ, closes: correlatedCloses(11_000n, 24, 11n), timestamps: ts, providerId: 'fixture_market' }),
      Object.freeze({ instrumentId: BTC, closes: correlatedCloses(50_000n, 24, 50n), timestamps: ts, providerId: 'fixture_crypto' }),
      Object.freeze({ instrumentId: ETH, closes: correlatedCloses(3_000n, 24, 3n), timestamps: ts, providerId: 'fixture_crypto' }),
    ]),
    regimeSnapshots: Object.freeze([
      Object.freeze({
        regimeId: 'risk_on_equity',
        label: 'Equity Risk-On',
        scope: 'ASSET_CLASS' as const,
        instrumentId: null,
        assetClass: 'ETF',
        characteristics: Object.freeze(['HIGH_BETA']),
        evaluatedAt: NOW,
        evidenceRefs: Object.freeze(['m13:regime:risk_on']),
      }),
    ]),
    macroEvents: Object.freeze([
      Object.freeze({
        eventId: 'wti.event.crude_inventory',
        category: 'crude_inventory_report',
        displayName: 'US Crude Inventory Report',
        affectedInstrumentIds: Object.freeze([WTI]),
        macroVariableIds: Object.freeze(['macro:energy:inventory']),
        scheduledAt: NOW,
        evaluatedAt: NOW,
        evidenceRefs: Object.freeze(['m14:event:crude_inventory']),
      }),
    ]),
    hypotheses: Object.freeze([
      Object.freeze({
        hypothesisId: 'hyp_spy_qqq_inverse',
        fromInstrumentId: SPY,
        toInstrumentId: QQQ,
        relationshipType: 'inversely_correlated_with' as const,
        source: 'OPPORTUNITY_RESEARCH_AGENT',
        rationale: 'Contradictory research hypothesis',
        confidence: 'LOW' as const,
        expiration: null,
        customerId: null,
      }),
      Object.freeze({
        hypothesisId: 'hyp_expired_gold_rates',
        fromInstrumentId: GOLD,
        toInstrumentId: 'INDEX:US:TNX:SIM',
        relationshipType: 'inversely_correlated_with' as const,
        source: 'OPPORTUNITY_RESEARCH_AGENT',
        rationale: 'Expired gold vs rates research hypothesis',
        confidence: 'LOW' as const,
        expiration: EXPIRED_AT,
        customerId: null,
      }),
      Object.freeze({
        hypothesisId: 'hyp_customer_private',
        fromInstrumentId: SPY,
        toInstrumentId: QQQ,
        relationshipType: 'relative_value_candidate_with' as const,
        source: 'CUSTOMER_RESEARCH',
        rationale: 'Customer-private note',
        confidence: 'MEDIUM' as const,
        expiration: null,
        customerId: 'cust_alpha',
      }),
    ]),
    marketStates: Object.freeze([degradedMarketState(SPY), degradedMarketState(QQQ)]),
    now: NOW,
  });
}

async function main(): Promise<void> {
  const store = new InMemoryCrossAssetGraphStore();
  const built = buildCrossAssetOpportunityGraph(buildInput());
  store.loadBuildResult(built, NOW);

  const related = queryCrossAssetOpportunityGraph(store, {
    queryKind: 'related_instruments',
    anchorNodeId: anchorNodeIdForInstrument(SPY),
    asOf: NOW,
  });
  const contradictions = queryCrossAssetOpportunityGraph(store, {
    queryKind: 'contradictory_signals',
    anchorNodeId: anchorNodeIdForInstrument(SPY),
    asOf: NOW,
    includeHypotheses: true,
    includeDegraded: true,
  });
  const snapshot = store.snapshot(NOW);
  const restored = new InMemoryCrossAssetGraphStore();
  restored.restore(snapshot);
  const bridge = bridgeCrossAssetGraphToOpportunityResearch({ store: restored, instrumentId: SPY, asOf: NOW });

  const result = evaluateMultiAssetM15Qualification({
    instrumentRelationshipModeled: built.edges.some((edge) => edge.relationshipType === 'underlying_of'),
    measuredCorrelationEdgeComputed: built.edges.some((edge) => edge.relationshipClass === 'MEASURED'),
    hypothesisEdgeSeparated: built.edges.some((edge) => edge.relationshipClass === 'HYPOTHESIS' && edge.validityState === 'HYPOTHESIS_ONLY'),
    expiredEdgeHandled: !store.edges({ asOf: NOW }).some((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_expired_gold_rates')),
    contradictoryRelationshipsDetected: contradictions.contradictoryPairs.length > 0,
    dataQualityDegradationPropagated: built.edges.some((edge) => edge.validityState === 'DEGRADED'),
    graphTraversalWorks: related.hits.length > 0,
    relatedOpportunitySearchWorks: bridge.relatedInstrumentIds.length > 0,
    evidenceLineageTraceable: bridge.evidenceRefs.every((row) => row.provenanceRef.length > 0),
    restartPreservesHistory: restored.nodes().length > 0,
    tenantIsolationEnforced: store.edges({ customerId: 'cust_beta' }).every((edge) => edge.customerId !== 'cust_alpha'),
    noExecutionAuthority: bridge.grantsExecutionAuthority === false,
    noLlmHypothesisAsConfirmed: built.edges
      .filter((edge) => edge.relationshipClass === 'HYPOTHESIS')
      .every((edge) => edge.validityState === 'HYPOTHESIS_ONLY' || edge.validityState === 'EXPIRED'),
  });

  console.log(JSON.stringify({ marker: result.marker, qualified: result.qualified, blockers: result.blockers }, null, 2));
  assert.equal(result.marker, HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED, result.blockers.join('; '));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
