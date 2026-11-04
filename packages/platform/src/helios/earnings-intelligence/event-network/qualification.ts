/**
 * EARN08 qualification gate.
 */

import { asUtcInstant } from '../../../../../domain/src/time.ts';
import { createTemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import { temporalEntityNodeIdFor } from '../../feature-fabric/entity-resolution/ids.ts';
import { createHeliosEarningsEventNetworkFabric } from './fabric.ts';
import { seedEarn08ReferenceEventNetwork } from './fixtures.ts';
import { isNaivePeadTradeRule } from './pead-diagnostic.ts';
import {
  HELIOS_EARN08_EVENT_NETWORK_BLOCKED,
  HELIOS_EARN08_EVENT_NETWORK_QUALIFIED,
} from './taxonomy.ts';

export type Earn08QualificationChecks = {
  readonly temporalGraphAnchored: boolean;
  readonly supplierRequiresEvidence: boolean;
  readonly peerReadThroughTemporalOrder: boolean;
  readonly laterReporterExcludedFromEarlierDecision: boolean;
  readonly attentionStatePresent: boolean;
  readonly peadConditionalNotNaiveTradeRule: boolean;
  readonly returnDecompositionLayers: boolean;
  readonly orthogonalResearchFeatures: boolean;
  readonly noExecutionAuthority: boolean;
};

export type Earn08QualificationResult = {
  readonly marker: typeof HELIOS_EARN08_EVENT_NETWORK_QUALIFIED | typeof HELIOS_EARN08_EVENT_NETWORK_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn08EventNetworkQualification(
  checks: Earn08QualificationChecks,
): Earn08QualificationResult {
  const blockers: string[] = [];
  if (!checks.temporalGraphAnchored) blockers.push('temporal_graph_anchored');
  if (!checks.supplierRequiresEvidence) blockers.push('supplier_requires_evidence');
  if (!checks.peerReadThroughTemporalOrder) blockers.push('peer_read_through_temporal_order');
  if (!checks.laterReporterExcludedFromEarlierDecision) {
    blockers.push('later_reporter_excluded_from_earlier_decision');
  }
  if (!checks.attentionStatePresent) blockers.push('attention_state');
  if (!checks.peadConditionalNotNaiveTradeRule) blockers.push('pead_not_naive_trade_rule');
  if (!checks.returnDecompositionLayers) blockers.push('return_decomposition');
  if (!checks.orthogonalResearchFeatures) blockers.push('orthogonal_research_features');
  if (!checks.noExecutionAuthority) blockers.push('no_execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_EARN08_EVENT_NETWORK_QUALIFIED : HELIOS_EARN08_EVENT_NETWORK_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function runEarn08QualificationHarness(): Earn08QualificationResult {
  const fixture = seedEarn08ReferenceEventNetwork();
  const decisionEarly = asUtcInstant('2025-01-20T12:00:00.000Z');
  const decisionLate = asUtcInstant('2025-02-21T12:00:00.000Z');

  const earlyPeerView = fixture.fabric.peerReadThrough({
    focalEvent: fixture.fabric.listEvents().find((e) => e.eventId === fixture.lateReporterEventId)!,
    asOfDecisionInstant: decisionLate,
    knowableCutoff: decisionLate,
  });

  const tsmEarlyDecision = fixture.fabric.peerReadThrough({
    focalEvent: fixture.fabric.listEvents().find((e) => e.eventId === fixture.earlyReporterEventId)!,
    asOfDecisionInstant: decisionEarly,
    knowableCutoff: decisionEarly,
  });

  const graph = createTemporalEntityGraphStore();
  const nv = graph.upsertNode({
    nodeId: temporalEntityNodeIdFor('earn08:qual:nv'),
    kind: 'SECURITY',
    displayName: 'NVDA',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'NVDA' }),
  });
  const cu = graph.upsertNode({
    nodeId: temporalEntityNodeIdFor('earn08:qual:cu'),
    kind: 'SECURITY',
    displayName: 'CUSTOMER',
    jurisdiction: 'US',
    economicKnowledgeEntityId: null,
    payload: Object.freeze({ symbol: 'CUST' }),
  });
  const fabric = createHeliosEarningsEventNetworkFabric({ entityGraph: graph });
  const supplierWithoutEvidence = fabric.registerRelationship({
    relationshipType: 'SUPPLIER',
    fromSecurityNodeId: nv.nodeId,
    toSecurityNodeId: cu.nodeId,
    evidenceRefs: Object.freeze([]),
    source: 'test',
    effectiveFrom: asUtcInstant('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
    observedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
    knowableAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
    jurisdiction: 'US',
  });

  const attention = fixture.fabric.attentionState({
    asOfInstant: decisionLate,
    focalSecurityNodeId: fixture.nvdaNodeId,
    marketAbsoluteReturnBps: 15,
    sectorAbsoluteReturnBps: 45,
    analystCoverage: 42,
    marketCapBucket: 'MEGA',
    liquidityBucket: 'HIGH',
    newsIntensity: 0.8,
    preEventVolumeAnomaly: 1.4,
  });

  const pead = fixture.fabric.peadConditional({
    eventId: fixture.lateReporterEventId,
    attentionState: attention,
    marketRegime: 'RISK_ON',
    evaluatedAt: decisionLate,
    historicalDriftSamples: Object.freeze([
      { horizonDays: 5, cumulativeDriftBps: 30 },
      { horizonDays: 60, cumulativeDriftBps: 55 },
    ]),
  });

  const decomposition = fixture.fabric.decomposeReturn({
    horizonDays: 5,
    rawReturnBps: 200,
    marketReturnBps: 50,
    sectorReturnBps: 80,
    factorReturns: Object.freeze([
      { factorId: 'MKT', returnBps: 50 },
      { factorId: 'SMB', returnBps: 10 },
    ]),
    factorLoadings: Object.freeze({ MKT: 1, SMB: 0.5 }),
  });

  const orth = fixture.fabric.orthogonalResearchFeatures({
    decomposition,
    covariates: Object.freeze({ surpriseMagnitudeBps: 80, MKT: 50, liquidityScore: 0.9 }),
  });

  const checks: Earn08QualificationChecks = {
    temporalGraphAnchored: earlyPeerView.informingPeerEventIds.includes(fixture.earlyReporterEventId),
    supplierRequiresEvidence: !supplierWithoutEvidence.ok,
    peerReadThroughTemporalOrder: earlyPeerView.peerSurpriseState !== 'UNKNOWN',
    laterReporterExcludedFromEarlierDecision: !tsmEarlyDecision.informingPeerEventIds.includes(
      fixture.lateReporterEventId,
    ),
    attentionStatePresent: attention.numberOfConcurrentEarningsEvents >= 1,
    peadConditionalNotNaiveTradeRule:
      pead !== null &&
      pead.researchOnly === true &&
      isNaivePeadTradeRule({ surpriseState: 'BEAT', action: 'buy for 60 days' }),
    returnDecompositionLayers:
      decomposition.rawReturnBps === 200 &&
      decomposition.marketAdjustedReturnBps === 150 &&
      decomposition.sectorAdjustedReturnBps === 70,
    orthogonalResearchFeatures: orth.targetResidualReturnBps !== null,
    noExecutionAuthority:
      pead?.grantsExecutionAuthority === false &&
      decomposition.grantsExecutionAuthority === false &&
      orth.grantsExecutionAuthority === false,
  };

  return evaluateEarn08EventNetworkQualification(checks);
}
