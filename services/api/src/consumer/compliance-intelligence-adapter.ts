/**
 * Consumer BFF adapter for compliance intelligence evidence.
 * No raw provider payloads, credentials, or internal thresholds exposed.
 */

import {
  buildComplianceAgentEvidence,
  complianceIntelligenceNow,
  complianceSeparationProof,
  createComplianceScreeningEvidenceService,
  privacySafeSubjectRef,
  type ComplianceScreeningEvidenceService,
} from '../../../../packages/kernel/src/compliance-intelligence/index.ts';

export type ComplianceIntelligenceBff = {
  readonly screeningStatus: (subjectRef: string, displayName: string) => Promise<{
    readonly schema: 'sunrey.bff.compliance-screening.v1';
    readonly status: 'CLEAR' | 'REVIEW' | 'UNAVAILABLE';
    readonly evidenceCount: number;
    readonly providerCount: number;
  }>;
  readonly agentEvidence: (subjectRef: string, displayName: string) => ReturnType<typeof buildComplianceAgentEvidence>;
  readonly separationProof: () => ReturnType<typeof complianceSeparationProof>;
  readonly auditRef: (subjectRef: string) => string;
};

export function createComplianceIntelligenceBff(
  service: ComplianceScreeningEvidenceService = createComplianceScreeningEvidenceService(),
): ComplianceIntelligenceBff {
  const nowUtc = complianceIntelligenceNow();
  return Object.freeze({
    screeningStatus: async (subjectRef, displayName) => {
      const evidence = await service.screenPerson({
        name: displayName,
        canonicalSubjectId: subjectRef,
        nowUtc,
      });
      const positive = evidence.filter((e) => e.match.matchType !== 'NEGATIVE_OBSERVATION');
      const providers = new Set(positive.map((e) => e.source.providerId));
      let status: 'CLEAR' | 'REVIEW' | 'UNAVAILABLE' = 'CLEAR';
      if (positive.some((e) => e.classification === 'SANCTIONS' || e.classification === 'WANTED')) {
        status = 'REVIEW';
      } else if (positive.some((e) => e.classification === 'PEP')) {
        status = 'REVIEW';
      }
      return Object.freeze({
        schema: 'sunrey.bff.compliance-screening.v1',
        status,
        evidenceCount: positive.length,
        providerCount: providers.size,
      });
    },
    agentEvidence: (subjectRef, displayName) =>
      buildComplianceAgentEvidence(service, {
        subjectRef,
        name: displayName,
        nowUtc,
      }),
    separationProof: () => complianceSeparationProof(),
    auditRef: (subjectRef) => privacySafeSubjectRef(subjectRef, `bff:${subjectRef}`),
  });
}
