/**
 * HELIOS EARN08 — earnings event network (peer transfer, attention, PEAD diagnostics).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_EARN08,
  HELIOS_EARN08_EVENT_NETWORK_QUALIFIED,
  HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY,
  HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA,
  assertEarningsRelationshipEvidence,
  createHeliosEarningsEventNetworkFabric,
  decomposeExpectedReturn,
  isNaivePeadTradeRule,
  runEarn08QualificationHarness,
  seedEarn08ReferenceEventNetwork,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import { createTemporalEntityGraphStore } from '../packages/platform/src/helios/feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../packages/platform/src/helios/feature-fabric/entity-resolution/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EARN08 earnings event network', () => {
  it('exports schema, chunk marker, and reference-only authority', () => {
    assert.equal(HELIOS_EARN08, 'HELIOS_EARN08');
    assert.equal(HELIOS_EARNINGS_EVENT_NETWORK_SCHEMA, 'sunrey.helios.earnings-event-network.v1');
    assert.equal(HELIOS_EARNINGS_EVENT_NETWORK_AUTHORITY, 'REFERENCE_ONLY');
  });

  it('rejects supplier relationships without evidence', () => {
    const check = assertEarningsRelationshipEvidence({
      relationshipType: 'SUPPLIER',
      fromSecurityNodeId: 'a',
      toSecurityNodeId: 'b',
      evidenceRefs: Object.freeze([]),
      source: 'test',
      effectiveFrom: asUtcInstant('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      observedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      knowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      jurisdiction: 'US',
    });
    assert.equal(check.ok, false);
  });

  it('applies peer read-through with time order (early reporter informs late reporter)', () => {
    const fixture = seedEarn08ReferenceEventNetwork();
    const nvdaEvent = fixture.fabric.listEvents().find((e) => e.eventId === fixture.lateReporterEventId)!;
    const readThrough = fixture.fabric.peerReadThrough({
      focalEvent: nvdaEvent,
      asOfDecisionInstant: asUtcInstant('2025-02-21T12:00:00.000Z'),
      knowableCutoff: asUtcInstant('2025-02-21T12:00:00.000Z'),
    });

    assert.ok(readThrough.informingPeerEventIds.includes(fixture.earlyReporterEventId));
    assert.equal(readThrough.peerSurpriseState, 'MIXED');
    assert.equal(readThrough.grantsExecutionAuthority, false);
  });

  it('excludes later reporters from earlier focal decisions', () => {
    const fixture = seedEarn08ReferenceEventNetwork();
    const tsmEvent = fixture.fabric.listEvents().find((e) => e.eventId === fixture.earlyReporterEventId)!;
    const readThrough = fixture.fabric.peerReadThrough({
      focalEvent: tsmEvent,
      asOfDecisionInstant: asUtcInstant('2025-01-20T12:00:00.000Z'),
      knowableCutoff: asUtcInstant('2025-01-20T12:00:00.000Z'),
    });
    assert.ok(!readThrough.informingPeerEventIds.includes(fixture.lateReporterEventId));
  });

  it('does not encode naive PEAD buy-for-60-days rule', () => {
    assert.equal(isNaivePeadTradeRule({ surpriseState: 'BEAT', action: 'buy for 60 days' }), true);
    const fixture = seedEarn08ReferenceEventNetwork();
    const pead = fixture.fabric.peadConditional({
      eventId: fixture.lateReporterEventId,
      attentionState: fixture.fabric.attentionState({
        asOfInstant: asUtcInstant('2025-02-21T12:00:00.000Z'),
        focalSecurityNodeId: fixture.nvdaNodeId,
      }),
      evaluatedAt: asUtcInstant('2025-02-21T12:00:00.000Z'),
    });
    assert.ok(pead);
    assert.equal(pead!.researchOnly, true);
  });

  it('decomposes expected returns through market, sector, and factor layers', () => {
    const decomposition = decomposeExpectedReturn({
      horizonDays: 20,
      rawReturnBps: 300,
      marketReturnBps: 40,
      sectorReturnBps: 30,
      factorReturns: Object.freeze([{ factorId: 'MKT', returnBps: 40 }]),
      factorLoadings: Object.freeze({ MKT: 1 }),
    });
    assert.equal(decomposition.marketAdjustedReturnBps, 260);
    assert.equal(decomposition.sectorAdjustedReturnBps, 230);
    assert.equal(decomposition.grantsExecutionAuthority, false);
  });

  it('qualifies EARN08 event network harness', () => {
    const result = runEarn08QualificationHarness();
    assert.equal(result.marker, HELIOS_EARN08_EVENT_NETWORK_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });

  it('anchors relationships on temporal entity graph SECURITY nodes', () => {
    const graph = createTemporalEntityGraphStore();
    const node = graph.upsertNode({
      nodeId: temporalEntityNodeIdFor('earn08:test:sec'),
      kind: 'SECURITY',
      displayName: 'TEST',
      jurisdiction: 'US',
      economicKnowledgeEntityId: null,
      payload: Object.freeze({ symbol: 'TEST' }),
    });
    const fabric = createHeliosEarningsEventNetworkFabric({ entityGraph: graph });
    const reg = fabric.registerRelationship({
      relationshipType: 'SAME_INDUSTRY',
      fromSecurityNodeId: node.nodeId,
      toSecurityNodeId: node.nodeId,
      evidenceRefs: Object.freeze(['evidence:test']),
      source: 'test',
      effectiveFrom: asUtcInstant('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
      observedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      knowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      jurisdiction: 'US',
    });
    assert.equal(reg.ok, false);
  });

  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });
});
