import type { ProductiveEventKey } from './productive-event-key.ts';
import type {
  AggregationLevel,
  CandidateProductiveEvent,
  OverlapAssessment,
  OverlapClass,
} from './productive-event-types.ts';
import {
  classifyTemporalOverlap,
  isAggregationTemporalRelationship,
  temporalWindowsOverlap,
  type TemporalWindow,
} from './temporal-overlap.ts';

const DEFAULT_QUANTITY_TOLERANCE_BPS = 500; // 5%

export function quantityWithinTolerance(
  left: bigint,
  right: bigint,
  toleranceBps = DEFAULT_QUANTITY_TOLERANCE_BPS,
): boolean {
  if (left === right) {
    return true;
  }
  const max = left > right ? left : right;
  if (max === 0n) {
    return true;
  }
  const diff = left > right ? left - right : right - left;
  const tolerance = (max * BigInt(toleranceBps)) / 10_000n;
  return diff <= tolerance;
}

function sameEntityAndMetric(left: CandidateProductiveEvent, right: CandidateProductiveEvent): boolean {
  return (
    left.canonicalEntityId === right.canonicalEntityId
    && left.economicAction === right.economicAction
    && left.metric === right.metric
    && left.unit === right.unit
  );
}

function parentChildRelationship(
  left: CandidateProductiveEvent,
  right: CandidateProductiveEvent,
): 'AGGREGATE_OF' | 'COMPONENT_OF' | null {
  if (left.parentEntityCommitment && right.parentEntityCommitment) {
    if (left.parentEntityCommitment === right.canonicalEntityId) {
      return 'COMPONENT_OF';
    }
    if (right.parentEntityCommitment === left.canonicalEntityId) {
      return 'AGGREGATE_OF';
    }
  }

  if (left.aggregationLevel === 'AGGREGATE' && right.aggregationLevel === 'COMPONENT') {
    return 'AGGREGATE_OF';
  }
  if (left.aggregationLevel === 'COMPONENT' && right.aggregationLevel === 'AGGREGATE') {
    return 'COMPONENT_OF';
  }

  return null;
}

function sharedBatchOrEventId(left: CandidateProductiveEvent, right: CandidateProductiveEvent): boolean {
  if (left.batchRunJobId && right.batchRunJobId && left.batchRunJobId === right.batchRunJobId) {
    return true;
  }
  return false;
}

/**
 * Classify overlap between two productive event candidates.
 * Does not merge solely on numeric similarity — requires entity, metric, time,
 * batch/event identifiers, or explicit parent/child lineage.
 */
export function classifyEventOverlap(
  left: CandidateProductiveEvent,
  right: CandidateProductiveEvent,
  toleranceBps = DEFAULT_QUANTITY_TOLERANCE_BPS,
): OverlapAssessment {
  const leftWindow: TemporalWindow = {
    validFromUtc: left.validFromUtc,
    validUntilUtc: left.validUntilUtc,
  };
  const rightWindow: TemporalWindow = {
    validFromUtc: right.validFromUtc,
    validUntilUtc: right.validUntilUtc,
  };

  const temporalOverlap = temporalWindowsOverlap(leftWindow, rightWindow);
  const temporalKind = classifyTemporalOverlap(leftWindow, rightWindow);
  const aggregationRelation = isAggregationTemporalRelationship(leftWindow, rightWindow);
  const parentChild = parentChildRelationship(left, right);

  if (left.eventKey === right.eventKey) {
    const qtyMatch = quantityWithinTolerance(left.quantity, right.quantity, toleranceBps);
    if (!qtyMatch) {
      return Object.freeze({
        leftEventKey: left.eventKey,
        rightEventKey: right.eventKey,
        overlapClass: 'UNRESOLVED',
        confidence: 'LOW',
        rationale: 'Identical event key with quantity divergence beyond tolerance',
        temporalOverlap,
        quantityToleranceBps: toleranceBps,
      });
    }
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: 'EXACT_DUPLICATE',
      confidence: 'HIGH',
      rationale: 'Identical event key and quantity',
      temporalOverlap,
      quantityToleranceBps: toleranceBps,
    });
  }

  if (sharedBatchOrEventId(left, right) && sameEntityAndMetric(left, right)) {
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: quantityWithinTolerance(left.quantity, right.quantity, toleranceBps)
        ? 'SAME_EVENT_CORROBORATION'
        : 'UNRESOLVED',
      confidence: 'HIGH',
      rationale: 'Shared batch/run/job identifier with matching entity and metric',
      temporalOverlap,
      quantityToleranceBps: toleranceBps,
    });
  }

  if (parentChild) {
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: parentChild,
      confidence: 'HIGH',
      rationale: `Explicit parent/child aggregation relationship: ${parentChild}`,
      temporalOverlap,
      quantityToleranceBps: null,
    });
  }

  if (aggregationRelation) {
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: aggregationRelation,
      confidence: 'HIGH',
      rationale: `Temporal aggregation relationship: ${aggregationRelation} (${temporalKind})`,
      temporalOverlap,
      quantityToleranceBps: null,
    });
  }

  if (sameEntityAndMetric(left, right) && temporalOverlap) {
    if (quantityWithinTolerance(left.quantity, right.quantity, toleranceBps)) {
      return Object.freeze({
        leftEventKey: left.eventKey,
        rightEventKey: right.eventKey,
        overlapClass: 'SAME_EVENT_CORROBORATION',
        confidence: 'MEDIUM',
        rationale: 'Same entity, metric, overlapping window, and quantity within tolerance',
        temporalOverlap,
        quantityToleranceBps: toleranceBps,
      });
    }
    if (temporalKind === 'PARTIAL') {
      return Object.freeze({
        leftEventKey: left.eventKey,
        rightEventKey: right.eventKey,
        overlapClass: 'PARTIAL_OVERLAP',
        confidence: 'LOW',
        rationale: 'Partial temporal overlap with quantity divergence',
        temporalOverlap,
        quantityToleranceBps: toleranceBps,
      });
    }
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: 'UNRESOLVED',
      confidence: 'LOW',
      rationale: 'Overlapping windows with divergent quantities — manual review required',
      temporalOverlap,
      quantityToleranceBps: toleranceBps,
    });
  }

  if (left.domain === right.domain && left.geographyCommitment === right.geographyCommitment
    && quantityWithinTolerance(left.quantity, right.quantity, toleranceBps)
    && !temporalOverlap) {
    return Object.freeze({
      leftEventKey: left.eventKey,
      rightEventKey: right.eventKey,
      overlapClass: 'DISTINCT_EVENT',
      confidence: 'MEDIUM',
      rationale: 'Similar quantity but non-overlapping temporal windows — distinct events',
      temporalOverlap: false,
      quantityToleranceBps: toleranceBps,
    });
  }

  return Object.freeze({
    leftEventKey: left.eventKey,
    rightEventKey: right.eventKey,
    overlapClass: 'DISTINCT_EVENT',
    confidence: 'HIGH',
    rationale: 'No shared identity, temporal, or lineage relationship',
    temporalOverlap,
    quantityToleranceBps: null,
  });
}

export function assessAllOverlaps(
  candidates: readonly CandidateProductiveEvent[],
  toleranceBps = DEFAULT_QUANTITY_TOLERANCE_BPS,
): readonly OverlapAssessment[] {
  const assessments: OverlapAssessment[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      assessments.push(classifyEventOverlap(candidates[i]!, candidates[j]!, toleranceBps));
    }
  }
  return Object.freeze(assessments);
}

export function groupByEventKey(
  candidates: readonly CandidateProductiveEvent[],
): ReadonlyMap<ProductiveEventKey, CandidateProductiveEvent[]> {
  const groups = new Map<ProductiveEventKey, CandidateProductiveEvent[]>();
  for (const candidate of candidates) {
    const list = groups.get(candidate.eventKey) ?? [];
    list.push(candidate);
    groups.set(candidate.eventKey, list);
  }
  return groups;
}

export function hasUnresolvedOverlap(assessments: readonly OverlapAssessment[]): boolean {
  return assessments.some((a) => a.overlapClass === 'UNRESOLVED' || a.overlapClass === 'PARTIAL_OVERLAP');
}

export function hasAggregationConflict(assessments: readonly OverlapAssessment[]): boolean {
  const aggregatePairs = assessments.filter(
    (a) => a.overlapClass === 'AGGREGATE_OF' || a.overlapClass === 'COMPONENT_OF',
  );
  const corroborating = assessments.filter(
    (a) => a.overlapClass === 'EXACT_DUPLICATE' || a.overlapClass === 'SAME_EVENT_CORROBORATION',
  );
  return aggregatePairs.length > 0 && corroborating.some((c) =>
    aggregatePairs.some((a) =>
      (a.leftEventKey === c.leftEventKey || a.rightEventKey === c.leftEventKey)
      && (a.leftEventKey === c.rightEventKey || a.rightEventKey === c.rightEventKey),
    ),
  );
}

export function selectCanonicalFromGroup(
  group: readonly CandidateProductiveEvent[],
): CandidateProductiveEvent {
  const sorted = [...group].sort((a, b) => {
    const levelOrder: Record<AggregationLevel, number> = { LEAF: 0, COMPONENT: 1, AGGREGATE: 2 };
    const levelDiff = levelOrder[a.aggregationLevel] - levelOrder[b.aggregationLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.observationIds.length - a.observationIds.length;
  });
  return sorted[0]!;
}

export function mergeCorroboratingCandidates(
  candidates: readonly CandidateProductiveEvent[],
  assessments: readonly OverlapAssessment[],
): readonly CandidateProductiveEvent[] {
  const corroboratingClasses: ReadonlySet<OverlapClass> = new Set([
    'EXACT_DUPLICATE',
    'SAME_EVENT_CORROBORATION',
  ]);

  const union = new Map<ProductiveEventKey, CandidateProductiveEvent>();
  for (const candidate of candidates) {
    const existing = union.get(candidate.eventKey);
    if (!existing) {
      union.set(candidate.eventKey, candidate);
      continue;
    }
    union.set(candidate.eventKey, Object.freeze({
      ...existing,
      observationIds: Object.freeze(
        [...new Set([...existing.observationIds, ...candidate.observationIds])].sort(),
      ),
      sourceClasses: Object.freeze(
        [...new Set([...existing.sourceClasses, ...candidate.sourceClasses])].sort(),
      ),
    }));
  }

  for (const assessment of assessments) {
    if (!corroboratingClasses.has(assessment.overlapClass)) {
      continue;
    }
    const left = union.get(assessment.leftEventKey);
    const right = union.get(assessment.rightEventKey);
    if (!left || !right) {
      continue;
    }
    const mergedObservations = Object.freeze(
      [...new Set([...left.observationIds, ...right.observationIds])].sort(),
    );
    const mergedSources = Object.freeze(
      [...new Set([...left.sourceClasses, ...right.sourceClasses])].sort(),
    );
    const canonical = selectCanonicalFromGroup([left, right]);
    union.set(canonical.eventKey, Object.freeze({
      ...canonical,
      observationIds: mergedObservations,
      sourceClasses: mergedSources,
    }));
    if (assessment.leftEventKey !== canonical.eventKey) {
      union.delete(assessment.leftEventKey);
    }
    if (assessment.rightEventKey !== canonical.eventKey) {
      union.delete(assessment.rightEventKey);
    }
  }

  return Object.freeze([...union.values()]);
}
