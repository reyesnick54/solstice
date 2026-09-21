/**
 * HELIOS Multi-Asset Expansion M15 — cross-asset opportunity graph tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import {
  anchorNodeIdForInstrument,
  bridgeCrossAssetGraphToOpportunityResearch,
  buildCrossAssetOpportunityGraph,
  evaluateMultiAssetM15Qualification,
  HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED,
  InMemoryCrossAssetGraphStore,
  nodeIdForInstrument,
  queryCrossAssetOpportunityGraph,
  type CrossAssetGraphBuildInput,
  type CrossAssetInstrumentInput,
  type MarketState,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { resolveMultiAssetInstrument } from '../packages/sunrey-exchange/src/capital-market/multi-asset/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

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
  assert.ok(row, instrumentId);
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

function timestamps(start: UtcInstant, count: number): readonly UtcInstant[] {
  const base = Date.parse(start);
  return Object.freeze(
    Array.from({ length: count }, (_, idx) => asUtcInstant(new Date(base + idx * 3_600_000).toISOString())),
  );
}

function baseBuildInput(overrides: Partial<CrossAssetGraphBuildInput> = {}): CrossAssetGraphBuildInput {
  const instruments = [SPY, QQQ, BTC, ETH, GOLD, WTI, GLD].map(toInstrumentInput);
  const closes = correlatedCloses(10_000n, 24);
  const ts = timestamps(asUtcInstant('2026-09-01T00:00:00.000Z'), 24);
  return Object.freeze({
    instruments,
    barSeries: Object.freeze([
      Object.freeze({ instrumentId: SPY, closes, timestamps: ts, providerId: 'fixture_market' }),
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
        characteristics: Object.freeze(['HIGH_BETA', 'LIQUID']),
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
        hypothesisId: 'hyp_gold_usd_research',
        fromInstrumentId: GOLD,
        toInstrumentId: 'CASH:GLOBAL:USD:SIM',
        relationshipType: 'historically_sensitive_to' as const,
        source: 'OPPORTUNITY_RESEARCH_AGENT',
        rationale: 'Research hypothesis: gold sensitivity to USD — not confirmed economics',
        confidence: 'LOW' as const,
        expiration: null,
        customerId: null,
      }),
      Object.freeze({
        hypothesisId: 'hyp_customer_private',
        fromInstrumentId: SPY,
        toInstrumentId: QQQ,
        relationshipType: 'relative_value_candidate_with' as const,
        source: 'CUSTOMER_RESEARCH',
        rationale: 'Customer-private relative value note',
        confidence: 'MEDIUM' as const,
        expiration: null,
        customerId: 'cust_alpha',
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
    ]),
    correlationLookback: '24h_aligned',
    correlationMinObservations: 5,
    correlationThreshold: 0.3,
    now: NOW,
    ...overrides,
  });
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

describe('HELIOS M15 cross-asset opportunity graph', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((row) => row.message).join('; '));
  });

  it('models instrument structural relationships from M01 identities', () => {
    const built = buildCrossAssetOpportunityGraph(baseBuildInput());
    const qqqUnderlying = built.edges.find(
      (edge) => edge.relationshipType === 'underlying_of' && edge.fromNodeId === nodeIdForInstrument(QQQ),
    );
    assert.ok(qqqUnderlying);
    assert.equal(qqqUnderlying.relationshipClass, 'STRUCTURAL');
    assert.equal(qqqUnderlying.validityState, 'ACTIVE');

    const gldProxy = built.edges.find(
      (edge) => edge.relationshipType === 'proxy_for' && edge.fromNodeId === nodeIdForInstrument(GLD),
    );
    assert.ok(gldProxy);
    assert.equal(gldProxy.toNodeId, nodeIdForInstrument(GOLD));
  });

  it('computes measured correlation edges from bar evidence', () => {
    const built = buildCrossAssetOpportunityGraph(baseBuildInput());
    const spyQqq = built.edges.find(
      (edge) =>
        edge.relationshipClass === 'MEASURED' &&
        edge.relationshipType === 'correlated_with' &&
        ((edge.fromNodeId === nodeIdForInstrument(SPY) && edge.toNodeId === nodeIdForInstrument(QQQ)) ||
          (edge.fromNodeId === nodeIdForInstrument(QQQ) && edge.toNodeId === nodeIdForInstrument(SPY))),
    );
    assert.ok(spyQqq, 'SPY/QQQ measured correlation missing');
    assert.ok(spyQqq.strength !== null && spyQqq.strength > 0.9);
    assert.equal(spyQqq.methodology, 'PEARSON_CORRELATION');
    assert.ok(spyQqq.evidence.length > 0);

    const btcEth = built.edges.find(
      (edge) =>
        edge.relationshipClass === 'MEASURED' &&
        edge.fromNodeId === nodeIdForInstrument(BTC) &&
        edge.toNodeId === nodeIdForInstrument(ETH),
    );
    assert.ok(btcEth);
  });

  it('keeps hypothesis edges separate and never confirmed', () => {
    const built = buildCrossAssetOpportunityGraph(baseBuildInput());
    const hypothesis = built.edges.find((edge) => edge.relationshipClass === 'HYPOTHESIS' && edge.source === 'OPPORTUNITY_RESEARCH_AGENT');
    assert.ok(hypothesis);
    assert.equal(hypothesis.validityState, 'HYPOTHESIS_ONLY');
    assert.notEqual(hypothesis.validityState, 'ACTIVE');
    assert.equal(hypothesis.methodology, 'RESEARCH_HYPOTHESIS');
  });

  it('handles expired hypothesis edges', () => {
    const built = buildCrossAssetOpportunityGraph(baseBuildInput());
    const expired = built.edges.find((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_expired_gold_rates'));
    assert.ok(expired);
    assert.equal(expired.validityState, 'EXPIRED');

    const store = new InMemoryCrossAssetGraphStore();
    store.loadBuildResult(built, NOW);
    const visible = store.edges({ asOf: NOW });
    assert.equal(
      visible.some((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_expired_gold_rates')),
      false,
    );
    const stored = store.allEdges().find((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_expired_gold_rates'));
    assert.ok(stored);
  });

  it('detects contradictory measured vs hypothesis relationships', () => {
    const input = baseBuildInput({
      hypotheses: Object.freeze([
        Object.freeze({
          hypothesisId: 'hyp_spy_qqq_inverse',
          fromInstrumentId: SPY,
          toInstrumentId: QQQ,
          relationshipType: 'inversely_correlated_with' as const,
          source: 'OPPORTUNITY_RESEARCH_AGENT',
          rationale: 'Contradictory hypothesis against measured positive correlation',
          confidence: 'LOW' as const,
          expiration: null,
          customerId: null,
        }),
      ]),
    });
    const store = new InMemoryCrossAssetGraphStore();
    store.loadBuildResult(buildCrossAssetOpportunityGraph(input), NOW);
    const result = queryCrossAssetOpportunityGraph(store, {
      queryKind: 'contradictory_signals',
      anchorNodeId: anchorNodeIdForInstrument(SPY),
      asOf: NOW,
      includeHypotheses: true,
    });
    assert.ok(result.contradictoryPairs.length > 0);
    assert.match(result.contradictoryPairs[0]?.reason ?? '', /Hypothesis contradicts measured/);
  });

  it('propagates data quality degradation to measured edges', () => {
    const built = buildCrossAssetOpportunityGraph(
      baseBuildInput({
        marketStates: Object.freeze([degradedMarketState(SPY), degradedMarketState(QQQ)]),
      }),
    );
    assert.ok(built.warnings.some((row) => row.includes('degraded')));
    const degradedEdge = built.edges.find(
      (edge) =>
        edge.relationshipClass === 'MEASURED' &&
        (edge.fromNodeId === nodeIdForInstrument(SPY) || edge.toNodeId === nodeIdForInstrument(SPY)),
    );
    assert.ok(degradedEdge);
    assert.equal(degradedEdge.validityState, 'DEGRADED');
  });

  it('supports graph traversal and related opportunity search', () => {
    const store = new InMemoryCrossAssetGraphStore();
    store.loadBuildResult(buildCrossAssetOpportunityGraph(baseBuildInput()), NOW);

    const related = queryCrossAssetOpportunityGraph(store, {
      queryKind: 'related_instruments',
      anchorNodeId: anchorNodeIdForInstrument(SPY),
      asOf: NOW,
    });
    assert.ok(related.hits.length > 0);
    assert.ok(related.hits.some((hit) => hit.relatedNode.externalRef === QQQ));

    const macro = queryCrossAssetOpportunityGraph(store, {
      queryKind: 'macro_context',
      anchorNodeId: anchorNodeIdForInstrument(WTI),
      asOf: NOW,
    });
    assert.ok(macro.hits.some((hit) => hit.relatedNode.nodeClass === 'event'));

    const bridge = bridgeCrossAssetGraphToOpportunityResearch({
      store,
      instrumentId: SPY,
      asOf: NOW,
    });
    assert.equal(bridge.researchOnly, true);
    assert.equal(bridge.grantsExecutionAuthority, false);
    assert.ok(bridge.relatedInstrumentIds.includes(QQQ));
    assert.ok(bridge.evidenceRefs.length > 0);
  });

  it('preserves evidence lineage and relationship history across restart', () => {
    const store = new InMemoryCrossAssetGraphStore();
    const built = buildCrossAssetOpportunityGraph(baseBuildInput());
    store.loadBuildResult(built, NOW);
    const edge = built.edges.find((row) => row.relationshipClass === 'MEASURED');
    assert.ok(edge);

    const updated = Object.freeze({
      ...edge,
      strength: 0.42,
      evidence: Object.freeze([
        ...edge.evidence,
        Object.freeze({
          evidenceId: 'ev_updated',
          kind: 'STATISTICAL_SERIES' as const,
          sourceRef: 'update',
          observedAt: NOW,
          provenanceRef: 'pearson:update',
          summary: 'Updated correlation evidence',
        }),
      ]),
    });
    store.upsertEdge(updated, NOW, 'correlation_refresh');
    const before = store.snapshot(NOW);

    const restored = new InMemoryCrossAssetGraphStore();
    restored.restore(before);
    const versions = restored.edgeVersions(edge.edgeId);
    assert.ok(versions.length >= 2);
    assert.equal(restored.getEdge(edge.edgeId)?.version, 2);
    assert.ok(restored.getEdge(edge.edgeId)?.evidence.some((row) => row.evidenceId === 'ev_updated'));
  });

  it('enforces tenant isolation for customer-scoped hypothesis edges', () => {
    const store = new InMemoryCrossAssetGraphStore();
    store.loadBuildResult(buildCrossAssetOpportunityGraph(baseBuildInput()), NOW);

    const globalEdges = store.edges({ customerId: null, asOf: NOW });
    const alphaEdges = store.edges({ customerId: 'cust_alpha', asOf: NOW });
    const betaEdges = store.edges({ customerId: 'cust_beta', asOf: NOW });

    assert.equal(globalEdges.some((edge) => edge.customerId === 'cust_alpha'), false);
    assert.equal(alphaEdges.some((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_customer_private')), true);
    assert.equal(betaEdges.some((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_customer_private')), false);
  });

  it('emits HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED when all checks pass', () => {
    const store = new InMemoryCrossAssetGraphStore();
    const built = buildCrossAssetOpportunityGraph(
      baseBuildInput({
        marketStates: Object.freeze([degradedMarketState(SPY), degradedMarketState(QQQ)]),
        hypotheses: Object.freeze([
          Object.freeze({
            hypothesisId: 'hyp_spy_qqq_inverse',
            fromInstrumentId: SPY,
            toInstrumentId: QQQ,
            relationshipType: 'inversely_correlated_with' as const,
            source: 'OPPORTUNITY_RESEARCH_AGENT',
            rationale: 'Contradictory hypothesis against measured positive correlation',
            confidence: 'LOW' as const,
            expiration: null,
            customerId: null,
          }),
        ]),
      }),
    );
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
    const before = store.snapshot(NOW);
    const restored = new InMemoryCrossAssetGraphStore();
    restored.restore(before);
    const bridge = bridgeCrossAssetGraphToOpportunityResearch({ store: restored, instrumentId: SPY, asOf: NOW });

    const qualification = evaluateMultiAssetM15Qualification({
      instrumentRelationshipModeled: built.edges.some((edge) => edge.relationshipType === 'underlying_of'),
      measuredCorrelationEdgeComputed: built.edges.some((edge) => edge.relationshipClass === 'MEASURED'),
      hypothesisEdgeSeparated: built.edges.some((edge) => edge.relationshipClass === 'HYPOTHESIS' && edge.validityState === 'HYPOTHESIS_ONLY'),
      expiredEdgeHandled: !store.edges({ asOf: NOW }).some((edge) => edge.evidence.some((row) => row.evidenceId === 'hyp_expired_gold_rates')),
      contradictoryRelationshipsDetected: contradictions.contradictoryPairs.length > 0,
      dataQualityDegradationPropagated: built.edges.some((edge) => edge.validityState === 'DEGRADED'),
      graphTraversalWorks: related.hits.length > 0,
      relatedOpportunitySearchWorks: bridge.relatedInstrumentIds.length > 0,
      evidenceLineageTraceable: bridge.evidenceRefs.every((row) => row.provenanceRef.length > 0),
      restartPreservesHistory: restored.edgeVersions().length > 0,
      tenantIsolationEnforced: store.edges({ customerId: 'cust_beta' }).every((edge) => edge.customerId !== 'cust_alpha'),
      noExecutionAuthority: bridge.grantsExecutionAuthority === false,
      noLlmHypothesisAsConfirmed: built.edges
        .filter((edge) => edge.relationshipClass === 'HYPOTHESIS')
        .every((edge) => edge.validityState === 'HYPOTHESIS_ONLY' || edge.validityState === 'EXPIRED'),
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED, qualification.blockers.join('; '));
  });
});
