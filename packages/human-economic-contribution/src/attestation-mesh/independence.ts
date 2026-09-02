/**
 * Source independence for human contribution attestations.
 *
 * Wave 4 lineage principle: publication database A, aggregator B copying A,
 * and research profile C populated from A represent one underlying evidence
 * lineage — not three independent confirmations.
 */

import type { ContributionAttestation } from './types.ts';
import type { AttestationSourceClass } from './source-classes.ts';
import { countsTowardIndependentEvidence } from './source-classes.ts';

export type AttestationIndependenceAnalysis = {
  readonly rawAttestationCount: number;
  readonly rawIssuerCount: number;
  readonly independentLineageRootCount: number;
  readonly independentSourceClassCount: number;
  readonly sharedLineageGroups: readonly {
    readonly lineageRootId: string;
    readonly upstreamOrganizationId: string;
    readonly attestationIds: readonly string[];
    readonly issuerClasses: readonly AttestationSourceClass[];
  }[];
  readonly endpointCountIsNotIndependence: true;
};

function lineageKey(attestation: ContributionAttestation): string {
  return attestation.lineageRootId;
}

export function analyzeAttestationIndependence(
  attestations: readonly ContributionAttestation[],
): AttestationIndependenceAnalysis {
  const issuerIds = new Set(attestations.map((row) => row.issuer));
  const lineageGroups = new Map<
    string,
    { lineageRootId: string; upstreamOrganizationId: string; attestationIds: string[]; issuerClasses: Set<AttestationSourceClass> }
  >();
  const independentClassKeys = new Set<string>();

  for (const attestation of attestations) {
    const key = lineageKey(attestation);
    const group = lineageGroups.get(key) ?? {
      lineageRootId: attestation.lineageRootId,
      upstreamOrganizationId: attestation.upstreamOrganizationId,
      attestationIds: [],
      issuerClasses: new Set<AttestationSourceClass>(),
    };
    group.attestationIds.push(attestation.attestationId);
    group.issuerClasses.add(attestation.issuerClass);
    lineageGroups.set(key, group);

    if (countsTowardIndependentEvidence(attestation.issuerClass) && attestation.validity === 'VALID') {
      independentClassKeys.add(`${attestation.issuerClass}:${key}`);
    }
  }

  const sharedLineageGroups = [...lineageGroups.values()]
    .map((group) =>
      Object.freeze({
        lineageRootId: group.lineageRootId,
        upstreamOrganizationId: group.upstreamOrganizationId,
        attestationIds: Object.freeze([...group.attestationIds].sort()),
        issuerClasses: Object.freeze([...group.issuerClasses].sort()),
      }),
    )
    .sort((left, right) => left.lineageRootId.localeCompare(right.lineageRootId));

  const independentLineageRoots = new Set(
    attestations
      .filter((row) => countsTowardIndependentEvidence(row.issuerClass) && row.validity === 'VALID')
      .map((row) => lineageKey(row)),
  );

  return Object.freeze({
    rawAttestationCount: attestations.length,
    rawIssuerCount: issuerIds.size,
    independentLineageRootCount: independentLineageRoots.size,
    independentSourceClassCount: independentClassKeys.size,
    sharedLineageGroups: Object.freeze(sharedLineageGroups),
    endpointCountIsNotIndependence: true,
  });
}

export function attestationsShareLineage(left: ContributionAttestation, right: ContributionAttestation): boolean {
  return (
    left.lineageRootId === right.lineageRootId ||
    left.upstreamOrganizationId === right.upstreamOrganizationId
  );
}

export function effectiveIndependentAttestationCount(attestations: readonly ContributionAttestation[]): number {
  return analyzeAttestationIndependence(attestations).independentLineageRootCount;
}

export function copiedSourceLineageDetected(attestations: readonly ContributionAttestation[]): boolean {
  const analysis = analyzeAttestationIndependence(attestations);
  return analysis.rawAttestationCount > 1 && analysis.independentLineageRootCount < analysis.rawAttestationCount;
}
