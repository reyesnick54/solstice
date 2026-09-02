import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { buildLineageRecord } from './lineage.ts';
import {
  assessAllOverlaps,
  groupByEventKey,
  hasAggregationConflict,
  hasUnresolvedOverlap,
  mergeCorroboratingCandidates,
  quantityWithinTolerance,
  selectCanonicalFromGroup,
} from './event-overlap.ts';
import { economicProofDigest } from './hash.ts';
import {
  deriveCanonicalEventIdFromKey,
  deriveProductiveEventKey,
  domainBoundaryDefaults,
  inferDomainFromAction,
  type ProductiveEventKeyMaterial,
} from './productive-event-key.ts';
import type {
  CandidateProductiveEvent,
  ProductiveEventReconciliationResult,
  QuantityReconciliation,
  ReconciliationFailure,
} from './productive-event-types.ts';
import { WAVE5_RECONCILIATION_SCHEMA_VERSION } from './productive-event-types.ts';
import type { EconomicObservation, LineageEdge } from './types.ts';

export const WAVE5_RECONCILIATION_METHODOLOGY = 'wave5-productive-event-reconciliation-v1' as const;

export type BuildCandidateInput = {
  readonly observation: EconomicObservation;
  readonly economicAction: string;
  readonly metric: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string | null;
  readonly domain?: ProductiveEventKeyMaterial['domain'];
  readonly boundaryStrategy?: ProductiveEventKeyMaterial['boundaryStrategy'];
  readonly geographyCommitment?: string;
  readonly batchRunJobId?: string;
  readonly sourceIndependentEventId?: string;
  readonly resourceOutputType?: string;
  readonly aggregationLevel?: ProductiveEventKeyMaterial['aggregationLevel'];
  readonly parentEntityCommitment?: string;
};

export function buildCandidateFromObservation(input: BuildCandidateInput): CandidateProductiveEvent {
  const domain = input.domain ?? inferDomainFromAction(input.economicAction);
  const defaults = domainBoundaryDefaults(domain);
  const eventKey = deriveProductiveEventKey({
    canonicalEntityId: input.observation.canonicalEntityId,
    economicAction: input.economicAction,
    metric: input.metric,
    unit: input.unit,
    validFromUtc: input.validFromUtc,
    validUntilUtc: input.validUntilUtc,
    domain,
    boundaryStrategy: input.boundaryStrategy ?? defaults.boundaryStrategy,
    geographyCommitment: input.geographyCommitment,
    batchRunJobId: input.batchRunJobId,
    sourceIndependentEventId: input.sourceIndependentEventId,
    resourceOutputType: input.resourceOutputType,
    aggregationLevel: input.aggregationLevel ?? 'LEAF',
    parentEntityCommitment: input.parentEntityCommitment,
  });

  return Object.freeze({
    eventKey,
    canonicalEntityId: input.observation.canonicalEntityId,
    canonicalEventId: input.observation.canonicalEventId,
    economicAction: input.economicAction,
    metric: input.metric,
    quantity: input.quantity,
    unit: input.unit,
    validFromUtc: asUtcInstant(input.validFromUtc),
    validUntilUtc: input.validUntilUtc ? asUtcInstant(input.validUntilUtc) : null,
    domain,
    aggregationLevel: input.aggregationLevel ?? 'LEAF',
    observationIds: Object.freeze([input.observation.observationId]),
    sourceClasses: Object.freeze([input.observation.sourceClass]),
    geographyCommitment: input.geographyCommitment,
    batchRunJobId: input.batchRunJobId,
    parentEntityCommitment: input.parentEntityCommitment,
  });
}

/**
 * Anti-inflation quantity reconciliation.
 * N corroborating observations of one event yield ONE quantity, never a sum.
 */
export function reconcileQuantity(
  candidates: readonly CandidateProductiveEvent[],
  methodology = WAVE5_RECONCILIATION_METHODOLOGY,
): QuantityReconciliation {
  const observedQuantities = candidates.flatMap((candidate) =>
    candidate.observationIds.map((observationId) =>
      Object.freeze({ observationId, quantity: candidate.quantity }),
    ),
  );

  const uniqueQuantities = [...new Set(candidates.map((c) => c.quantity))];
  const naiveSummedQuantity = observedQuantities.reduce((sum, entry) => sum + entry.quantity, 0n);
  const summedQuantity = uniqueQuantities.reduce((sum, q) => sum + q, 0n);

  let reconciledQuantity: bigint;
  if (uniqueQuantities.length === 1) {
    reconciledQuantity = uniqueQuantities[0]!;
  } else {
    const sorted = [...uniqueQuantities].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    reconciledQuantity = sorted[Math.floor(sorted.length / 2)]!;
  }

  const inflationPrevented = naiveSummedQuantity > reconciledQuantity;

  return Object.freeze({
    methodology,
    reconciledQuantity,
    observedQuantities: Object.freeze(observedQuantities),
    inflationPrevented,
    summedQuantity: naiveSummedQuantity,
  });
}

export function deriveReconciliationId(eventKeys: readonly string[]): string {
  return economicProofDigest(['reconciliation', ...[...eventKeys].sort()]);
}

export type ReconcileEventsInput = {
  readonly candidates: readonly CandidateProductiveEvent[];
  readonly methodologyVersion?: string;
  readonly quantityToleranceBps?: number;
  readonly lineageEdges?: readonly LineageEdge[];
  readonly evidenceRefs?: readonly string[];
};

export function reconcileProductiveEvents(
  input: ReconcileEventsInput,
): Result<ProductiveEventReconciliationResult, ReconciliationFailure> {
  if (input.candidates.length === 0) {
    return err({ code: 'NO_CANDIDATES', message: 'No candidate events to reconcile' });
  }

  const methodologyVersion = input.methodologyVersion ?? WAVE5_RECONCILIATION_METHODOLOGY;
  const toleranceBps = input.quantityToleranceBps ?? 500;

  const overlapAssessments = assessAllOverlaps(input.candidates, toleranceBps);
  const merged = mergeCorroboratingCandidates(input.candidates, overlapAssessments);
  const groups = groupByEventKey(merged);

  if (hasUnresolvedOverlap(overlapAssessments)) {
    const lineageResult = buildLineageRecord({
      edges: input.lineageEdges ?? [],
      methodologyVersion,
    });
    if (!lineageResult.ok) {
      return err({ code: 'UNRESOLVED_OVERLAP', message: lineageResult.error.message });
    }

    return ok(Object.freeze({
      schemaVersion: WAVE5_RECONCILIATION_SCHEMA_VERSION,
      reconciliationId: deriveReconciliationId(input.candidates.map((c) => c.eventKey)),
      methodologyVersion,
      candidateEvents: Object.freeze([...input.candidates]),
      overlapAssessments,
      canonicalEventKey: null,
      canonicalEventId: null,
      quantityReconciliation: null,
      resolutionStatus: 'UNRESOLVED',
      confidence: 'LOW',
      requiresManualReview: true,
      evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
      lineage: lineageResult.value,
      resolvedAtUtc: asUtcInstant(new Date().toISOString()),
    }));
  }

  if (hasAggregationConflict(overlapAssessments)) {
    return err({
      code: 'AGGREGATION_DOUBLE_COUNT',
      message: 'Aggregate and component events would double-count if merged naively',
    });
  }

  if (groups.size > 1) {
    const allDistinct = overlapAssessments.every((a) => a.overlapClass === 'DISTINCT_EVENT');
    if (!allDistinct) {
      return err({
        code: 'UNRESOLVED_OVERLAP',
        message: 'Multiple unresolved event groups remain after reconciliation',
      });
    }
  }

  const groupValues = [...groups.values()];
  const canonicalGroup = groupValues.length === 1
    ? groupValues[0]!
    : groupValues.reduce((best, group) => (group.length > best.length ? group : best), groupValues[0]!);

  const canonical = selectCanonicalFromGroup(canonicalGroup);

  const corroboratingKeys = new Set<ProductiveEventKey>();
  for (const assessment of overlapAssessments) {
    if (assessment.overlapClass === 'EXACT_DUPLICATE' || assessment.overlapClass === 'SAME_EVENT_CORROBORATION') {
      corroboratingKeys.add(assessment.leftEventKey);
      corroboratingKeys.add(assessment.rightEventKey);
    }
  }
  corroboratingKeys.add(canonical.eventKey);

  const quantityCandidates = input.candidates.filter((candidate) =>
    corroboratingKeys.has(candidate.eventKey),
  );
  const quantityReconciliation = reconcileQuantity(
    quantityCandidates.length > 0 ? quantityCandidates : canonicalGroup,
    methodologyVersion,
  );

  if (quantityReconciliation.inflationPrevented
    && quantityReconciliation.summedQuantity > quantityReconciliation.reconciledQuantity * 2n) {
    const quantities = canonicalGroup.map((c) => c.quantity);
    const allWithinTolerance = quantities.every((q) =>
      quantityWithinTolerance(q, quantityReconciliation.reconciledQuantity, toleranceBps),
    );
    if (!allWithinTolerance) {
      return err({
        code: 'QUANTITY_INFLATION_RISK',
        message: `Summed quantity ${quantityReconciliation.summedQuantity} would inflate beyond reconciled ${quantityReconciliation.reconciledQuantity}`,
      });
    }
  }

  const canonicalEventId = deriveCanonicalEventIdFromKey(
    canonical.eventKey,
    {
      canonicalEntityId: canonical.canonicalEntityId,
      economicAction: canonical.economicAction,
      quantity: quantityReconciliation.reconciledQuantity,
      unit: canonical.unit,
      validFromUtc: canonical.validFromUtc,
      validUntilUtc: canonical.validUntilUtc,
      locationCommitment: canonical.geographyCommitment,
      domainIdentifierCommitment: canonical.batchRunJobId,
    },
  );

  const aggregationEdges: LineageEdge[] = [];
  for (const assessment of overlapAssessments) {
    if (assessment.overlapClass === 'AGGREGATE_OF' || assessment.overlapClass === 'COMPONENT_OF') {
      aggregationEdges.push(Object.freeze({
        kind: 'AGGREGATED_FROM' as const,
        parentRef: assessment.overlapClass === 'COMPONENT_OF'
          ? assessment.leftEventKey
          : assessment.rightEventKey,
        childRef: assessment.overlapClass === 'AGGREGATE_OF'
          ? assessment.leftEventKey
          : assessment.rightEventKey,
        methodologyVersion,
        transformation: assessment.overlapClass,
      }));
    }
  }

  const lineageResult = buildLineageRecord({
    edges: [...(input.lineageEdges ?? []), ...aggregationEdges],
    methodologyVersion,
    producedRefs: [canonical.eventKey],
  });
  if (!lineageResult.ok) {
    return err({ code: 'UNRESOLVED_OVERLAP', message: lineageResult.error.message });
  }

  const sourceCount = new Set(canonical.sourceClasses).size;
  const obsCount = canonical.observationIds.length;
  const confidence: ProductiveEventReconciliationResult['confidence'] =
    obsCount >= 3 && sourceCount >= 2 ? 'HIGH' : obsCount >= 2 ? 'MEDIUM' : 'LOW';

  return ok(Object.freeze({
    schemaVersion: WAVE5_RECONCILIATION_SCHEMA_VERSION,
    reconciliationId: deriveReconciliationId([canonical.eventKey]),
    methodologyVersion,
    candidateEvents: Object.freeze([...input.candidates]),
    overlapAssessments,
    canonicalEventKey: canonical.eventKey,
    canonicalEventId,
    quantityReconciliation,
    resolutionStatus: 'RESOLVED',
    confidence,
    requiresManualReview: false,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    lineage: lineageResult.value,
    resolvedAtUtc: asUtcInstant(new Date().toISOString()),
  }));
}

export function isReconciliationClaimReady(
  reconciliation: ProductiveEventReconciliationResult,
): boolean {
  return reconciliation.resolutionStatus === 'RESOLVED'
    && reconciliation.canonicalEventKey !== null
    && reconciliation.canonicalEventId !== null
    && reconciliation.quantityReconciliation !== null
    && !reconciliation.requiresManualReview;
}
