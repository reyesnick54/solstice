import {
  countIndependentForQuorum,
  twoEndpointsOneUpstreamAreNotAutomaticallyIndependent,
} from '../independence.ts';
import type { CertificationSubject, IndependenceConformanceResult } from './types.ts';

export function evaluateIndependence(subject: CertificationSubject): IndependenceConformanceResult {
  const details: string[] = [];
  const related = [
    {
      feedId: subject.feedId,
      sourceId: subject.sourceId,
      providerId: subject.providerId,
      controllerId: subject.controllerId,
      upstreamOrganizationId: subject.upstreamOrganizationId,
      sharedControlGroup: subject.sharedControlGroup,
    },
    ...subject.relatedFeeds,
  ];

  const shared = related.filter(
    (row) =>
      row.feedId !== subject.feedId &&
      (row.controllerId === subject.controllerId ||
        row.upstreamOrganizationId === subject.upstreamOrganizationId ||
        (row.sharedControlGroup !== null && row.sharedControlGroup === subject.sharedControlGroup)),
  );

  const sources = related.map((row) => ({
    schemaVersion: 1 as const,
    sourceId: row.sourceId,
    version: 1,
    providerId: row.providerId,
    category: subject.sourceCategory,
    factType: subject.factType,
    feedId: row.feedId,
    unit: subject.unit,
    schemaId: subject.schemaId,
    sourceSchemaVersion: subject.schemaVersion,
    normalizationVersion: subject.normalizationVersion,
    authenticationMethod: subject.connector.authenticationClass,
    credentialRef: null,
    controllerId: row.controllerId,
    upstreamOrganizationId: row.upstreamOrganizationId,
    infrastructureRegion: 'sandbox',
    retired: false,
  }));

  const independentControllerCount = countIndependentForQuorum(sources, true);
  let fakeQuorum = false;
  if (shared.length > 0) {
    fakeQuorum = true;
    details.push(
      `feeds ${[subject.feedId, ...shared.map((row) => row.feedId)].join(',')} share controller ${subject.controllerId}`,
    );
  }

  for (const other of subject.relatedFeeds) {
    const independent = twoEndpointsOneUpstreamAreNotAutomaticallyIndependent(
      {
        schemaVersion: 1,
        sourceId: subject.sourceId,
        controllerId: subject.controllerId,
        upstreamOrganizationId: subject.upstreamOrganizationId,
        infrastructureRegion: 'sandbox',
        sharedControlGroup: subject.sharedControlGroup,
      },
      {
        schemaVersion: 1,
        sourceId: other.sourceId,
        controllerId: other.controllerId,
        upstreamOrganizationId: other.upstreamOrganizationId,
        infrastructureRegion: 'sandbox',
        sharedControlGroup: other.sharedControlGroup,
      },
      true,
    );
    if (!independent) {
      fakeQuorum = true;
      details.push(`feed ${other.feedId} is not an independent source from ${subject.feedId}`);
    }
  }

  return Object.freeze({
    verdict: fakeQuorum ? 'FAIL' : 'PASS',
    independentControllerCount,
    sharedControllerFeeds: Object.freeze(shared.map((row) => row.feedId)),
    fakeQuorum,
    details: Object.freeze(details.length > 0 ? details : ['no shared-controller fake quorum detected']),
  });
}
