import type { UtcInstant } from '@solstice/domain';
import { PROBABILITY_PPM_SCALE } from '../../open-source/os14-prediction-market/probability.ts';
import {
  MIN_DOMAINS_FOR_RESEARCH_TRIGGER,
  type CrossMarketResearchTriggerKind,
  type CrossMarketSignalDomain,
  type DislocationSeverityBand,
} from './taxonomy.ts';
import type {
  CrossAssetConfirmation,
  CrossAssetContradiction,
  CrossMarketDislocation,
  CrossMarketEvidenceGraph,
  CrossMarketProbabilityState,
  CrossMarketSignalObservation,
} from './types.ts';

function uniqueDomains(observations: readonly CrossMarketSignalObservation[]): CrossMarketSignalDomain[] {
  return [...new Set(observations.map((o) => o.domain))];
}

function severityFromMagnitude(magnitudeBps: number): DislocationSeverityBand {
  const abs = Math.abs(magnitudeBps);
  if (abs >= 120) return 'SEVERE';
  if (abs >= 60) return 'ELEVATED';
  return 'LOW';
}

function observationsIncludeMetric(observations: readonly CrossMarketSignalObservation[], metricId: string): boolean {
  return observations.some((o) => o.metricId === metricId);
}

function researchKindForObservations(
  observations: readonly CrossMarketSignalObservation[],
): CrossMarketResearchTriggerKind | null {
  const domains = uniqueDomains(observations);
  const set = new Set(domains);
  const sharp = observations.filter((o) => Math.abs(o.moveBps) >= 40);
  const cryptoHeavy =
    set.has('CRYPTO') &&
    (set.has('PREDICTION_MARKET') || observationsIncludeMetric(observations, 'venue_divergence'));
  if (cryptoHeavy && sharp.length >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER) return 'CRYPTO_RESEARCH';
  const macroHeavy =
    (set.has('MACRO') || set.has('PREDICTION_MARKET') || (set.has('FX') && set.has('FUTURES'))) &&
    (set.has('ETF') || set.has('INDICES') || set.has('EQUITIES') || set.has('FUTURES'));
  if (macroHeavy && set.size >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER) return 'MACRO_RESEARCH';
  return null;
}

export function evaluateCrossMarketProbabilityStates(input: {
  readonly observations: readonly CrossMarketSignalObservation[];
  readonly now: UtcInstant;
}): readonly CrossMarketProbabilityState[] {
  const byEntity = new Map<string, CrossMarketSignalObservation[]>();
  for (const obs of input.observations) {
    if (obs.impliedProbabilityPpm === null && !obs.metricId.includes('probability')) continue;
    const list = byEntity.get(obs.entityId) ?? [];
    list.push(obs);
    byEntity.set(obs.entityId, list);
  }

  const states: CrossMarketProbabilityState[] = [];
  for (const [entityId, rows] of byEntity) {
    const prediction = rows.find((r) => r.domain === 'PREDICTION_MARKET');
    const venue = rows.find((r) => r.domain === 'CRYPTO' && r.metricId.includes('settlement'));
    const research = rows.find((r) => r.domain === 'AGENT_RESEARCH');
    const predictionPpm = prediction?.impliedProbabilityPpm ?? null;
    const venuePpm = venue?.impliedProbabilityPpm ?? null;
    const priorPpm = research?.impliedProbabilityPpm ?? null;
    const left = predictionPpm ?? venuePpm;
    const right = venuePpm ?? priorPpm;
    let divergence = 0n;
    if (left !== null && right !== null) {
      divergence = left > right ? left - right : right - left;
      if (divergence > PROBABILITY_PPM_SCALE) divergence = PROBABILITY_PPM_SCALE;
    }
    if (left === null && right === null) continue;
    states.push(
      Object.freeze({
        stateId: `cm_prob_${entityId}`,
        subjectEntityId: entityId,
        predictionMarketPpm: predictionPpm,
        venueImpliedPpm: venuePpm,
        researchPriorPpm: priorPpm,
        divergencePpm: divergence,
        evidenceRefs: Object.freeze(rows.map((r) => r.evidenceRef)),
        evaluatedAt: input.now,
      }),
    );
  }
  return Object.freeze(states);
}

export function detectCrossAssetConfirmations(input: {
  readonly graph: CrossMarketEvidenceGraph;
  readonly observations: readonly CrossMarketSignalObservation[];
}): readonly CrossAssetConfirmation[] {
  const positive = input.observations.filter((o) => o.moveBps > 25);
  const negative = input.observations.filter((o) => o.moveBps < -25);
  const confirmations: CrossAssetConfirmation[] = [];

  if (positive.length >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER) {
    const domains = uniqueDomains(positive);
    confirmations.push(
      Object.freeze({
        confirmationId: `cm_conf_up_${domains.join('_')}`,
        theme: 'aligned_risk_on',
        directionalSign: 'UP',
        nodeIds: Object.freeze(positive.map((o) => `cm_node_${o.domain}_${o.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_'))),
        alignedMoveBps: Object.freeze(positive.map((o) => o.moveBps)),
        evidenceRefs: Object.freeze(positive.map((o) => o.evidenceRef)),
        confidenceBand: domains.length >= 4 ? 'HIGH' : 'MEDIUM',
      }),
    );
  }

  if (negative.length >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER) {
    const domains = uniqueDomains(negative);
    confirmations.push(
      Object.freeze({
        confirmationId: `cm_conf_down_${domains.join('_')}`,
        theme: 'aligned_risk_off',
        directionalSign: 'DOWN',
        nodeIds: Object.freeze(negative.map((o) => `cm_node_${o.domain}_${o.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_'))),
        alignedMoveBps: Object.freeze(negative.map((o) => o.moveBps)),
        evidenceRefs: Object.freeze(negative.map((o) => o.evidenceRef)),
        confidenceBand: domains.length >= 4 ? 'HIGH' : 'MEDIUM',
      }),
    );
  }

  void input.graph;
  return Object.freeze(confirmations);
}

export function detectCrossAssetContradictions(input: {
  readonly observations: readonly CrossMarketSignalObservation[];
}): readonly CrossAssetContradiction[] {
  const contradictions: CrossAssetContradiction[] = [];
  const byTheme = new Map<string, CrossMarketSignalObservation[]>();
  for (const obs of input.observations) {
    const theme = obs.entityId.split(':')[0] ?? obs.entityId;
    const list = byTheme.get(theme) ?? [];
    list.push(obs);
    byTheme.set(theme, list);
  }

  for (const [theme, rows] of byTheme) {
    const hasUp = rows.some((r) => r.moveBps > 30);
    const hasDown = rows.some((r) => r.moveBps < -30);
    if (!hasUp || !hasDown) continue;
    const magnitude =
      rows.reduce((acc, r) => acc + Math.abs(r.moveBps), 0) / Math.max(rows.length, 1);
    contradictions.push(
      Object.freeze({
        contradictionId: `cm_contra_${theme}`,
        theme,
        nodeIds: Object.freeze(
          rows.map((o) => `cm_node_${o.domain}_${o.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_')),
        ),
        opposingMoveBps: Object.freeze(rows.map((o) => o.moveBps)),
        evidenceRefs: Object.freeze(rows.map((r) => r.evidenceRef)),
        severity: severityFromMagnitude(magnitude),
      }),
    );
  }
  return Object.freeze(contradictions);
}

export function detectCrossMarketDislocations(input: {
  readonly graph: CrossMarketEvidenceGraph;
  readonly observations: readonly CrossMarketSignalObservation[];
  readonly probabilityStates: readonly CrossMarketProbabilityState[];
  readonly now: UtcInstant;
}): readonly CrossMarketDislocation[] {
  const dislocations: CrossMarketDislocation[] = [];

  const sharpMoves = input.observations.filter((o) => Math.abs(o.moveBps) >= 40);
  const sharpDomainCount = uniqueDomains(sharpMoves).length;
  if (
    sharpMoves.length >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER &&
    (sharpDomainCount >= MIN_DOMAINS_FOR_RESEARCH_TRIGGER ||
      researchKindForObservations(sharpMoves) === 'CRYPTO_RESEARCH')
  ) {
    const domains = uniqueDomains(sharpMoves);
    const magnitude =
      sharpMoves.reduce((acc, o) => acc + Math.abs(o.moveBps), 0) / sharpMoves.length;
    const involvedNodeIds = sharpMoves.map(
      (o) => `cm_node_${o.domain}_${o.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_'),
    );
    const triggerKind = researchKindForObservations(sharpMoves);
    dislocations.push(
      Object.freeze({
        dislocationId: `cm_disloc_${input.graph.graphId}`,
        severity: severityFromMagnitude(magnitude),
        involvedNodeIds: Object.freeze(involvedNodeIds),
        involvedDomains: Object.freeze(domains),
        compositeMagnitudeBps: magnitude,
        evidenceRefs: Object.freeze(sharpMoves.map((o) => o.evidenceRef)),
        researchTriggerKind: triggerKind,
        correlationIsNotTradeSignal: true as const,
        detectedAt: input.now,
      }),
    );
  }

  for (const prob of input.probabilityStates) {
    if (prob.divergencePpm < 50_000n) continue;
    const related = input.observations.filter((o) => o.entityId === prob.subjectEntityId);
    const domains = uniqueDomains(related);
    if (domains.length < 2) continue;
    dislocations.push(
      Object.freeze({
        dislocationId: `cm_disloc_prob_${prob.stateId}`,
        severity: prob.divergencePpm >= 120_000n ? 'SEVERE' : 'ELEVATED',
        involvedNodeIds: Object.freeze(
          related.map((o) => `cm_node_${o.domain}_${o.entityId}`.replace(/[^a-zA-Z0-9:_-]/g, '_')),
        ),
        involvedDomains: Object.freeze(domains),
        compositeMagnitudeBps: Number(prob.divergencePpm / 1000n),
        evidenceRefs: prob.evidenceRefs,
        researchTriggerKind: researchKindForObservations(related),
        correlationIsNotTradeSignal: true as const,
        detectedAt: input.now,
      }),
    );
  }

  void input.graph;
  return Object.freeze(dislocations);
}
