/**
 * Observation grouping, independence accounting, cross-family
 * correlation candidates, and pre-consensus conflict reports.
 *
 * Does not aggregate into a VerifiedEconomicFact and does not resolve
 * attribution or oracle disputes.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import type { EconomicDataCollectionEnvelope, ObservationGroup, ObservationGroupKey } from './types.ts';
import type {
  CorrelationConfidence,
  CrossProviderConflictCandidate,
  EconomicEventCorrelationCandidate,
  ProviderFamilyId,
} from './types.ts';

const CROSS_FAMILY_PAIRS: readonly (readonly [ProviderFamilyId, ProviderFamilyId])[] = Object.freeze([
  ['MANUFACTURING', 'AUTOMATED_MACHINE_OUTPUT'],
  ['MANUFACTURING', 'GOODS'],
  ['AUTOMATED_MACHINE_OUTPUT', 'GOODS'],
  ['GOODS', 'LOGISTICS'],
  ['COMPUTE', 'AI_COMPUTE'],
  ['REAL_ESTATE', 'INFRASTRUCTURE'],
]);

function pairMatches(left: ProviderFamilyId, right: ProviderFamilyId): boolean {
  return CROSS_FAMILY_PAIRS.some(
    ([a, b]) => (a === left && b === right) || (a === right && b === left),
  );
}

export function observationGroupKeyOf(envelope: EconomicDataCollectionEnvelope): ObservationGroupKey {
  return Object.freeze({
    factType: envelope.factType,
    subjectRef: envelope.subjectRef,
    measurementStart: envelope.measurementStart,
    measurementEnd: envelope.measurementEnd,
    geographyKey: `${envelope.geography.jurisdiction}:${envelope.geography.region}:${envelope.geography.locality}`,
    unitSemantics: envelope.sourceQuantity.unit,
  });
}

export function groupIdOf(key: ObservationGroupKey): string {
  return sha256Hex(
    `edf.group.v1:${key.factType}:${key.subjectRef}:${key.measurementStart.toString()}:${key.measurementEnd.toString()}:${key.geographyKey}:${key.unitSemantics}`,
  );
}

export function groupObservations(
  envelopes: readonly EconomicDataCollectionEnvelope[],
  controllers: Readonly<Record<string, { readonly controllerId: string; readonly sharedControlGroup: string | null }>> = {},
): readonly ObservationGroup[] {
  const buckets = new Map<string, EconomicDataCollectionEnvelope[]>();
  for (const envelope of envelopes) {
    const key = observationGroupKeyOf(envelope);
    const id = groupIdOf(key);
    const existing = buckets.get(id) ?? [];
    existing.push(envelope);
    buckets.set(id, existing);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([, rows]) => {
      const key = observationGroupKeyOf(rows[0]!);
      const controllerIds = new Set<string>();
      const shared = new Set<string>();
      for (const row of rows) {
        const meta = controllers[row.sourceId] ?? { controllerId: row.providerId, sharedControlGroup: null };
        controllerIds.add(meta.controllerId);
        if (meta.sharedControlGroup) {
          shared.add(meta.sharedControlGroup);
        }
      }
      return Object.freeze({
        groupId: groupIdOf(key),
        key,
        envelopeIds: Object.freeze(rows.map((row) => row.envelopeId).sort()),
        rawSourceCount: rows.length,
        independentControllerCount: controllerIds.size,
        sharedControlGroups: Object.freeze([...shared].sort()),
        aggregatedIntoVerifiedFact: false,
      });
    });
}

export function analyzeIndependentSources(
  sources: readonly {
    readonly sourceId: string;
    readonly controllerId: string;
    readonly upstreamOrganizationId: string;
    readonly sharedControlGroup: string | null;
    readonly endpointId?: string;
  }[],
): {
  readonly rawSourceCount: number;
  readonly independentControllerCount: number;
  readonly sharedControlGroups: readonly string[];
  readonly endpointCountIsNotIndependence: true;
} {
  const controllers = new Set(sources.map((row) => row.controllerId));
  const shared = [...new Set(sources.map((row) => row.sharedControlGroup).filter((row): row is string => row !== null))];
  return Object.freeze({
    rawSourceCount: sources.length,
    independentControllerCount: controllers.size,
    sharedControlGroups: Object.freeze(shared.sort()),
    endpointCountIsNotIndependence: true,
  });
}

function lineageEvidence(left: EconomicDataCollectionEnvelope, right: EconomicDataCollectionEnvelope): readonly string[] {
  const evidence: string[] = [];
  if (left.provenanceRef && left.provenanceRef === right.provenanceRef) {
    evidence.push('shared-provenance-ref');
  }
  if (left.subjectRef === right.subjectRef) {
    evidence.push('same-subject');
  }
  if (left.feedId === right.feedId) {
    evidence.push('same-feed');
  }
  return Object.freeze(evidence);
}

export function detectCorrelationCandidates(
  envelopes: readonly EconomicDataCollectionEnvelope[],
  links: readonly {
    readonly leftEnvelopeId: string;
    readonly rightEnvelopeId: string;
    readonly batchRef?: string | null;
    readonly objectRef?: string | null;
    readonly lineageRef?: string | null;
    readonly sameControllerOnly?: boolean;
    readonly sameQuantityOnly?: boolean;
    readonly nearbyTimeOnly?: boolean;
  }[] = [],
): readonly EconomicEventCorrelationCandidate[] {
  const byId = new Map(envelopes.map((row) => [row.envelopeId, row]));
  const out: EconomicEventCorrelationCandidate[] = [];
  for (const link of links) {
    const left = byId.get(link.leftEnvelopeId);
    const right = byId.get(link.rightEnvelopeId);
    if (!left || !right || left.envelopeId === right.envelopeId) {
      continue;
    }
    if (!pairMatches(left.familyId, right.familyId)) {
      out.push(candidate(left, right, 'NO_CORRELATION', ['families-not-in-overlap-set']));
      continue;
    }
    if (link.sameQuantityOnly || link.nearbyTimeOnly || link.sameControllerOnly) {
      out.push(candidate(left, right, 'NO_CORRELATION', ['weak-signal-only']));
      continue;
    }
    const evidence = [...lineageEvidence(left, right)];
    if (link.lineageRef) {
      evidence.push('lineage-ref');
    }
    if (link.batchRef) {
      evidence.push('batch-ref');
    }
    if (link.objectRef) {
      evidence.push('object-ref');
    }
    const strong = evidence.includes('lineage-ref') || evidence.includes('batch-ref') || evidence.includes('object-ref');
    const confidence: CorrelationConfidence = strong
      ? evidence.includes('lineage-ref') && evidence.includes('batch-ref')
        ? 'AUTHORITATIVE_REFERENCE'
        : 'STRONG_CORRELATION'
      : evidence.length > 0
        ? 'POSSIBLE_CORRELATION'
        : 'NO_CORRELATION';
    out.push(candidate(left, right, confidence, evidence));
  }
  return Object.freeze(out);
}

function candidate(
  left: EconomicDataCollectionEnvelope,
  right: EconomicDataCollectionEnvelope,
  confidence: CorrelationConfidence,
  evidence: readonly string[],
): EconomicEventCorrelationCandidate {
  return Object.freeze({
    candidateId: sha256Hex(`edf.corr.v1:${left.envelopeId}:${right.envelopeId}`),
    leftEnvelopeId: left.envelopeId,
    rightEnvelopeId: right.envelopeId,
    leftFamilyId: left.familyId,
    rightFamilyId: right.familyId,
    confidence,
    evidence: Object.freeze([...evidence]),
    merged: false,
    attributionResolved: false,
  });
}

export function reportCrossProviderConflicts(
  envelopes: readonly EconomicDataCollectionEnvelope[],
  materialSpreadBps = 1_000,
): readonly CrossProviderConflictCandidate[] {
  const groups = groupObservations(envelopes);
  const conflicts: CrossProviderConflictCandidate[] = [];
  for (const group of groups) {
    const rows = envelopes.filter((row) => group.envelopeIds.includes(row.envelopeId));
    if (rows.length < 2) {
      continue;
    }
    const units = new Set(rows.map((row) => row.sourceQuantity.unit));
    if (units.size !== 1) {
      continue;
    }
    const values = rows.map((row) => row.sourceQuantity.mantissa);
    const min = values.reduce((acc, value) => (value < acc ? value : acc));
    const max = values.reduce((acc, value) => (value > acc ? value : acc));
    if (min === 0n) {
      if (max === 0n) {
        continue;
      }
      conflicts.push(conflictOf(group.groupId, rows));
      continue;
    }
    const spreadBps = Number(((max - min) * 10_000n) / min);
    if (spreadBps >= materialSpreadBps) {
      conflicts.push(conflictOf(group.groupId, rows));
    }
  }
  return Object.freeze(conflicts);
}

function conflictOf(
  groupId: string,
  rows: readonly EconomicDataCollectionEnvelope[],
): CrossProviderConflictCandidate {
  const first = rows[0]!;
  return Object.freeze({
    conflictId: sha256Hex(`edf.conflict.v1:${groupId}`),
    subjectRef: first.subjectRef,
    factType: first.factType,
    measurementStart: first.measurementStart,
    measurementEnd: first.measurementEnd,
    quantities: Object.freeze(
      rows.map((row) =>
        Object.freeze({
          envelopeId: row.envelopeId,
          providerId: row.providerId,
          mantissa: row.sourceQuantity.mantissa,
          unit: row.sourceQuantity.unit,
        }),
      ),
    ),
    resolved: false,
    oracleConsensusAuthoritative: true,
  });
}

export function prepareObservationBatch(
  group: ObservationGroup,
  envelopes: readonly EconomicDataCollectionEnvelope[],
): {
  readonly batchId: string;
  readonly groupId: string;
  readonly feedId: string;
  readonly subject: string;
  readonly drafts: readonly {
    readonly envelopeId: string;
    readonly providerId: string;
    readonly sourceId: string;
    readonly factType: EconomicDataCollectionEnvelope['factType'];
    readonly sourceQuantity: EconomicDataCollectionEnvelope['sourceQuantity'];
    readonly contentCommitment: string;
    readonly measurementStart: bigint;
    readonly measurementEnd: bigint;
  }[];
  readonly fabricFinalizesFact: false;
  readonly fabricCountsAsQuorum: false;
} {
  const members = envelopes
    .filter((row) => group.envelopeIds.includes(row.envelopeId))
    .slice()
    .sort((left, right) => (left.envelopeId < right.envelopeId ? -1 : 1));
  const first = members[0];
  return Object.freeze({
    batchId: sha256Hex(`edf.obs-batch.v1:${group.groupId}`),
    groupId: group.groupId,
    feedId: first?.feedId ?? '',
    subject: first?.subjectRef ?? '',
    drafts: Object.freeze(
      members.map((row) =>
        Object.freeze({
          envelopeId: row.envelopeId,
          providerId: row.providerId,
          sourceId: row.sourceId,
          factType: row.factType,
          sourceQuantity: row.sourceQuantity,
          contentCommitment: row.contentCommitment,
          measurementStart: row.measurementStart,
          measurementEnd: row.measurementEnd,
        }),
      ),
    ),
    fabricFinalizesFact: false,
    fabricCountsAsQuorum: false,
  });
}
