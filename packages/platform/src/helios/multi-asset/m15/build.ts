/**
 * HELIOS M15 cross-asset opportunity graph builder.
 *
 * Separates structural, measured, and hypothesis relationships.
 * Does not promote LLM or research hypotheses to confirmed economics.
 */

import type { UtcInstant } from '@solstice/domain';
import type { MarketState } from '../market-state-types.ts';
import { confidenceBandForCorrelation, computePairwiseCorrelations } from './correlation.ts';
import {
  edgeIdForPair,
  nodeIdForAssetClass,
  nodeIdForCurrency,
  nodeIdForEvent,
  nodeIdForInstrument,
  nodeIdForMacroVariable,
  nodeIdForProvider,
  nodeIdForRegime,
} from './ids.ts';
import type {
  CrossAssetGraphBuildInput,
  CrossAssetGraphBuildResult,
  CrossAssetGraphNode,
  CrossAssetRelationshipEdge,
  CrossAssetEdgeEvidence,
} from './types.ts';
import type { CrossAssetEdgeType, EdgeConfidenceBand, EdgeValidityState } from './taxonomy.ts';

function freezeNode(node: CrossAssetGraphNode): CrossAssetGraphNode {
  return Object.freeze(node);
}

function freezeEdge(edge: CrossAssetRelationshipEdge): CrossAssetRelationshipEdge {
  return Object.freeze({
    ...edge,
    evidence: Object.freeze(edge.evidence.map((row) => Object.freeze(row))),
  });
}

function evidenceRow(
  evidenceId: string,
  kind: CrossAssetEdgeEvidence['kind'],
  sourceRef: string,
  observedAt: UtcInstant,
  provenanceRef: string,
  summary: string,
): CrossAssetEdgeEvidence {
  return Object.freeze({ evidenceId, kind, sourceRef, observedAt, provenanceRef, summary });
}

function baseEdge(input: {
  edgeId: string;
  relationshipType: CrossAssetEdgeType;
  relationshipClass: CrossAssetRelationshipEdge['relationshipClass'];
  fromNodeId: string;
  toNodeId: string;
  source: string;
  methodology: CrossAssetRelationshipEdge['methodology'];
  strength: number | null;
  confidence: EdgeConfidenceBand;
  lookback: string | null;
  timestamp: UtcInstant;
  evidence: readonly CrossAssetEdgeEvidence[];
  expiration: UtcInstant | null;
  validityState: EdgeValidityState;
  customerId: string | null;
}): CrossAssetRelationshipEdge {
  return freezeEdge(
    Object.freeze({
      ...input,
      version: 1,
      authoritative: false,
      mutatesFinancialState: false,
    }),
  );
}

function resolveValidity(asOf: UtcInstant, expiration: UtcInstant | null, relationshipClass: CrossAssetRelationshipEdge['relationshipClass']): EdgeValidityState {
  if (expiration && Date.parse(asOf) > Date.parse(expiration)) {
    return 'EXPIRED';
  }
  if (relationshipClass === 'HYPOTHESIS') {
    return 'HYPOTHESIS_ONLY';
  }
  return 'ACTIVE';
}

function instrumentNodes(input: CrossAssetGraphBuildInput): Map<string, CrossAssetGraphNode> {
  const nodes = new Map<string, CrossAssetGraphNode>();
  for (const row of input.instruments) {
    nodes.set(
      nodeIdForInstrument(row.instrumentId),
      freezeNode(
        Object.freeze({
          nodeId: nodeIdForInstrument(row.instrumentId),
          nodeClass: 'instrument',
          label: row.symbol,
          externalRef: row.instrumentId,
          payload: Object.freeze({
            assetClass: row.assetClass,
            currency: row.currency,
          }),
          createdAt: input.now,
          authoritative: false,
          mutatesFinancialState: false,
        }),
      ),
    );
    const classNodeId = nodeIdForAssetClass(row.assetClass);
    if (!nodes.has(classNodeId)) {
      nodes.set(
        classNodeId,
        freezeNode(
          Object.freeze({
            nodeId: classNodeId,
            nodeClass: 'asset_class',
            label: row.assetClass,
            externalRef: row.assetClass,
            payload: Object.freeze({}),
            createdAt: input.now,
            authoritative: false,
            mutatesFinancialState: false,
          }),
        ),
      );
    }
    const currencyNodeId = nodeIdForCurrency(row.currency);
    if (!nodes.has(currencyNodeId)) {
      nodes.set(
        currencyNodeId,
        freezeNode(
          Object.freeze({
            nodeId: currencyNodeId,
            nodeClass: 'currency',
            label: row.currency.toUpperCase(),
            externalRef: row.currency.toUpperCase(),
            payload: Object.freeze({}),
            createdAt: input.now,
            authoritative: false,
            mutatesFinancialState: false,
          }),
        ),
      );
    }
  }
  return nodes;
}

function addStructuralEdges(
  input: CrossAssetGraphBuildInput,
  nodes: Map<string, CrossAssetGraphNode>,
  edges: CrossAssetRelationshipEdge[],
): void {
  for (const row of input.instruments) {
    const fromId = nodeIdForInstrument(row.instrumentId);
    edges.push(
      baseEdge({
        edgeId: edgeIdForPair('denominated_in', fromId, nodeIdForCurrency(row.currency), 'STRUCTURAL', null),
        relationshipType: 'denominated_in',
        relationshipClass: 'STRUCTURAL',
        fromNodeId: fromId,
        toNodeId: nodeIdForCurrency(row.currency),
        source: 'M01_INSTRUMENT',
        methodology: 'M01_REGISTRY',
        strength: 1,
        confidence: 'HIGH',
        lookback: null,
        timestamp: input.now,
        evidence: Object.freeze([
          evidenceRow(`ev_${row.instrumentId}_denom`, 'INSTRUMENT_REGISTRY', row.instrumentId, input.now, 'm01:registry', 'Instrument currency denomination'),
        ]),
        expiration: null,
        validityState: 'ACTIVE',
        customerId: null,
      }),
    );
    edges.push(
      baseEdge({
        edgeId: edgeIdForPair('exposed_to', fromId, nodeIdForAssetClass(row.assetClass), 'STRUCTURAL', null),
        relationshipType: 'exposed_to',
        relationshipClass: 'STRUCTURAL',
        fromNodeId: fromId,
        toNodeId: nodeIdForAssetClass(row.assetClass),
        source: 'M01_INSTRUMENT',
        methodology: 'M01_REGISTRY',
        strength: 1,
        confidence: 'HIGH',
        lookback: null,
        timestamp: input.now,
        evidence: Object.freeze([
          evidenceRow(`ev_${row.instrumentId}_class`, 'INSTRUMENT_REGISTRY', row.instrumentId, input.now, 'm01:registry', 'Instrument asset class membership'),
        ]),
        expiration: null,
        validityState: 'ACTIVE',
        customerId: null,
      }),
    );
    if (row.underlyingInstrumentId) {
      const toId = nodeIdForInstrument(row.underlyingInstrumentId);
      if (!nodes.has(toId)) {
        nodes.set(
          toId,
          freezeNode(
            Object.freeze({
              nodeId: toId,
              nodeClass: 'instrument',
              label: row.underlyingInstrumentId,
              externalRef: row.underlyingInstrumentId,
              payload: Object.freeze({}),
              createdAt: input.now,
              authoritative: false,
              mutatesFinancialState: false,
            }),
          ),
        );
      }
      edges.push(
        baseEdge({
          edgeId: edgeIdForPair('underlying_of', fromId, toId, 'STRUCTURAL', null),
          relationshipType: 'underlying_of',
          relationshipClass: 'STRUCTURAL',
          fromNodeId: fromId,
          toNodeId: toId,
          source: 'M01_INSTRUMENT',
          methodology: 'M01_REGISTRY',
          strength: 1,
          confidence: 'HIGH',
          lookback: null,
          timestamp: input.now,
          evidence: Object.freeze([
            evidenceRow(`ev_${row.instrumentId}_und`, 'INSTRUMENT_REGISTRY', row.instrumentId, input.now, 'm01:underlying', 'Registry underlying link'),
          ]),
          expiration: null,
          validityState: 'ACTIVE',
          customerId: null,
        }),
      );
    }
    if (row.proxyForInstrumentId) {
      const toId = nodeIdForInstrument(row.proxyForInstrumentId);
      edges.push(
        baseEdge({
          edgeId: edgeIdForPair('proxy_for', fromId, toId, 'STRUCTURAL', null),
          relationshipType: 'proxy_for',
          relationshipClass: 'STRUCTURAL',
          fromNodeId: fromId,
          toNodeId: toId,
          source: 'M01_INSTRUMENT',
          methodology: 'M01_REGISTRY',
          strength: 1,
          confidence: 'HIGH',
          lookback: null,
          timestamp: input.now,
          evidence: Object.freeze([
            evidenceRow(`ev_${row.instrumentId}_proxy`, 'INSTRUMENT_REGISTRY', row.instrumentId, input.now, 'm01:proxy', 'Registry proxy link'),
          ]),
          expiration: null,
          validityState: 'ACTIVE',
          customerId: null,
        }),
      );
    }
  }

  for (const link of input.structuralLinks ?? []) {
    const fromId = nodeIdForInstrument(link.fromInstrumentId);
    const toId = nodeIdForInstrument(link.toInstrumentId);
    edges.push(
      baseEdge({
        edgeId: edgeIdForPair(link.relationshipType, fromId, toId, 'STRUCTURAL', null),
        relationshipType: link.relationshipType,
        relationshipClass: 'STRUCTURAL',
        fromNodeId: fromId,
        toNodeId: toId,
        source: link.source,
        methodology: 'M01_REGISTRY',
        strength: 1,
        confidence: 'HIGH',
        lookback: null,
        timestamp: input.now,
        evidence: Object.freeze(
          link.evidenceRefs.map((ref, idx) =>
            evidenceRow(`ev_struct_${idx}_${link.fromInstrumentId}`, 'INSTRUMENT_REGISTRY', ref, input.now, ref, 'Structural registry link'),
          ),
        ),
        expiration: null,
        validityState: 'ACTIVE',
        customerId: null,
      }),
    );
  }
}

function addMeasuredEdges(
  input: CrossAssetGraphBuildInput,
  edges: CrossAssetRelationshipEdge[],
  warnings: string[],
  degradedInstrumentIds: ReadonlySet<string>,
): void {
  const series = (input.barSeries ?? []).map((row) =>
    Object.freeze({
      instrumentId: row.instrumentId,
      closes: row.closes,
      timestamps: row.timestamps,
    }),
  );
  const correlations = computePairwiseCorrelations(series, {
    lookbackLabel: input.correlationLookback ?? 'aligned_tail',
    minObservations: input.correlationMinObservations ?? 5,
    threshold: input.correlationThreshold ?? 0.3,
  });

  for (const row of correlations) {
    const relationshipType: CrossAssetEdgeType =
      row.coefficient >= 0 ? 'correlated_with' : 'inversely_correlated_with';
    const fromId = nodeIdForInstrument(row.instrumentA);
    const toId = nodeIdForInstrument(row.instrumentB);
    const confidence = confidenceBandForCorrelation(row.coefficient, row.observationCount);
    const degraded = degradedInstrumentIds.has(row.instrumentA) || degradedInstrumentIds.has(row.instrumentB);
    if (degraded) {
      warnings.push(`measured edge degraded for ${row.instrumentA}<->${row.instrumentB}`);
    }
    edges.push(
      baseEdge({
        edgeId: edgeIdForPair(relationshipType, fromId, toId, 'MEASURED', null),
        relationshipType,
        relationshipClass: 'MEASURED',
        fromNodeId: fromId,
        toNodeId: toId,
        source: 'M15_CORRELATION_ENGINE',
        methodology: 'PEARSON_CORRELATION',
        strength: row.coefficient,
        confidence,
        lookback: row.lookbackLabel,
        timestamp: input.now,
        evidence: Object.freeze([
          evidenceRow(
            `ev_corr_${row.instrumentA}_${row.instrumentB}`,
            'STATISTICAL_SERIES',
            `${row.instrumentA}:${row.instrumentB}`,
            row.alignedTo,
            `pearson:${row.observationCount}`,
            `Pearson correlation ${row.coefficient.toFixed(4)} over ${row.observationCount} aligned returns`,
          ),
        ]),
        expiration: null,
        validityState: degraded ? 'DEGRADED' : 'ACTIVE',
        customerId: null,
      }),
    );
  }
}

function degradedInstrumentsFromMarketStates(states: readonly MarketState[] | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const state of states ?? []) {
    if (state.dataQuality.state === 'INSUFFICIENT' || state.dataQuality.state === 'INVALID') {
      out.add(state.instrumentId);
    }
    if (state.providerHealth === 'OUTAGE' || state.freshness === 'STALE') {
      out.add(state.instrumentId);
    }
  }
  return out;
}

function addRegimeAndMacroEdges(input: CrossAssetGraphBuildInput, nodes: Map<string, CrossAssetGraphNode>, edges: CrossAssetRelationshipEdge[]): void {
  for (const regime of input.regimeSnapshots ?? []) {
    const regimeNodeId = nodeIdForRegime(regime.regimeId);
    nodes.set(
      regimeNodeId,
      freezeNode(
        Object.freeze({
          nodeId: regimeNodeId,
          nodeClass: 'market_regime',
          label: regime.label,
          externalRef: regime.regimeId,
          payload: Object.freeze({ scope: regime.scope }),
          createdAt: regime.evaluatedAt,
          authoritative: false,
          mutatesFinancialState: false,
        }),
      ),
    );
    const targets =
      regime.scope === 'INSTRUMENT' && regime.instrumentId
        ? [regime.instrumentId]
        : regime.scope === 'ASSET_CLASS' && regime.assetClass
          ? input.instruments.filter((row) => row.assetClass === regime.assetClass).map((row) => row.instrumentId)
          : input.instruments.map((row) => row.instrumentId);
    for (const instrumentId of targets) {
      const fromId = nodeIdForInstrument(instrumentId);
      edges.push(
        baseEdge({
          edgeId: edgeIdForPair('regime_linked_to', fromId, regimeNodeId, 'STRUCTURAL', null),
          relationshipType: 'regime_linked_to',
          relationshipClass: 'STRUCTURAL',
          fromNodeId: fromId,
          toNodeId: regimeNodeId,
          source: 'M13_REGIME',
          methodology: 'M13_REGIME',
          strength: null,
          confidence: 'MEDIUM',
          lookback: null,
          timestamp: regime.evaluatedAt,
          evidence: Object.freeze(
            regime.evidenceRefs.map((ref, idx) =>
              evidenceRow(`ev_regime_${regime.regimeId}_${idx}`, 'REGIME_SNAPSHOT', ref, regime.evaluatedAt, ref, 'M13 regime snapshot'),
            ),
          ),
          expiration: null,
          validityState: 'ACTIVE',
          customerId: null,
        }),
      );
    }
  }

  for (const event of input.macroEvents ?? []) {
    const eventNodeId = nodeIdForEvent(event.eventId);
    nodes.set(
      eventNodeId,
      freezeNode(
        Object.freeze({
          nodeId: eventNodeId,
          nodeClass: 'event',
          label: event.displayName,
          externalRef: event.eventId,
          payload: Object.freeze({ category: event.category }),
          createdAt: event.evaluatedAt,
          authoritative: false,
          mutatesFinancialState: false,
        }),
      ),
    );
    for (const variableId of event.macroVariableIds) {
      const macroNodeId = nodeIdForMacroVariable(variableId);
      if (!nodes.has(macroNodeId)) {
        nodes.set(
          macroNodeId,
          freezeNode(
            Object.freeze({
              nodeId: macroNodeId,
              nodeClass: 'macro_variable',
              label: variableId,
              externalRef: variableId,
              payload: Object.freeze({}),
              createdAt: event.evaluatedAt,
              authoritative: false,
              mutatesFinancialState: false,
            }),
          ),
        );
      }
      edges.push(
        baseEdge({
          edgeId: edgeIdForPair('historically_sensitive_to', macroNodeId, eventNodeId, 'STRUCTURAL', null),
          relationshipType: 'historically_sensitive_to',
          relationshipClass: 'STRUCTURAL',
          fromNodeId: macroNodeId,
          toNodeId: eventNodeId,
          source: 'M14_MACRO_EVENT',
          methodology: 'M14_MACRO_EVENT',
          strength: null,
          confidence: 'MEDIUM',
          lookback: null,
          timestamp: event.evaluatedAt,
          evidence: Object.freeze([
            evidenceRow(`ev_macro_${variableId}_${event.eventId}`, 'MACRO_EVENT', event.eventId, event.evaluatedAt, event.eventId, 'Macro variable event linkage'),
          ]),
          expiration: null,
          validityState: 'ACTIVE',
          customerId: null,
        }),
      );
    }
    for (const instrumentId of event.affectedInstrumentIds) {
      const fromId = nodeIdForInstrument(instrumentId);
      edges.push(
        baseEdge({
          edgeId: edgeIdForPair('event_impacted_by', fromId, eventNodeId, 'STRUCTURAL', null),
          relationshipType: 'event_impacted_by',
          relationshipClass: 'STRUCTURAL',
          fromNodeId: fromId,
          toNodeId: eventNodeId,
          source: 'M14_MACRO_EVENT',
          methodology: 'M14_MACRO_EVENT',
          strength: null,
          confidence: 'MEDIUM',
          lookback: null,
          timestamp: event.evaluatedAt,
          evidence: Object.freeze(
            event.evidenceRefs.map((ref, idx) =>
              evidenceRow(`ev_event_${event.eventId}_${idx}`, 'MACRO_EVENT', ref, event.evaluatedAt, ref, 'M14 macro event impact'),
            ),
          ),
          expiration: null,
          validityState: 'ACTIVE',
          customerId: null,
        }),
      );
    }
  }

  for (const state of input.marketStates ?? []) {
    if (!state.evidenceRefs.length) {
      continue;
    }
    const providerIds = new Set(state.evidenceRefs.map((ref) => ref.refId.split(':')[0] ?? 'unknown'));
    for (const providerId of providerIds) {
      const providerNodeId = nodeIdForProvider(providerId);
      if (!nodes.has(providerNodeId)) {
        nodes.set(
          providerNodeId,
          freezeNode(
            Object.freeze({
              nodeId: providerNodeId,
              nodeClass: 'provider_data_source',
              label: providerId,
              externalRef: providerId,
              payload: Object.freeze({}),
              createdAt: state.evaluatedAt,
              authoritative: false,
              mutatesFinancialState: false,
            }),
          ),
        );
      }
    }
  }
}

function addHypothesisEdges(input: CrossAssetGraphBuildInput, edges: CrossAssetRelationshipEdge[]): void {
  for (const row of input.hypotheses ?? []) {
    const fromId = nodeIdForInstrument(row.fromInstrumentId);
    const toId = nodeIdForInstrument(row.toInstrumentId);
    edges.push(
      baseEdge({
        edgeId: edgeIdForPair(row.relationshipType, fromId, toId, 'HYPOTHESIS', row.customerId),
        relationshipType: row.relationshipType,
        relationshipClass: 'HYPOTHESIS',
        fromNodeId: fromId,
        toNodeId: toId,
        source: row.source,
        methodology: 'RESEARCH_HYPOTHESIS',
        strength: null,
        confidence: row.confidence,
        lookback: null,
        timestamp: input.now,
        evidence: Object.freeze([
          evidenceRow(row.hypothesisId, 'RESEARCH_NOTE', row.hypothesisId, input.now, row.hypothesisId, row.rationale),
        ]),
        expiration: row.expiration,
        validityState: resolveValidity(input.now, row.expiration, 'HYPOTHESIS'),
        customerId: row.customerId,
      }),
    );
  }
}

export function buildCrossAssetOpportunityGraph(input: CrossAssetGraphBuildInput): CrossAssetGraphBuildResult {
  const nodes = instrumentNodes(input);
  const edges: CrossAssetRelationshipEdge[] = [];
  const warnings: string[] = [];
  const degradedInstrumentIds = degradedInstrumentsFromMarketStates(input.marketStates);

  addStructuralEdges(input, nodes, edges);
  addRegimeAndMacroEdges(input, nodes, edges);
  addMeasuredEdges(input, edges, warnings, degradedInstrumentIds);
  addHypothesisEdges(input, edges);

  return Object.freeze({
    nodes: Object.freeze([...nodes.values()]),
    edges: Object.freeze(edges),
    warnings: Object.freeze(warnings),
  });
}
