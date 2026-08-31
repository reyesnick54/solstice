/**
 * Agent evidence bridge — compliance intelligence for Financial Agent.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ComplianceScreeningEvidenceService } from './service.ts';
import { complianceSeparationProof } from './separation.ts';
import type { ComplianceEvidence } from './types.ts';

export type ComplianceAgentEvidence = {
  readonly schema: 'sunrey.agent.compliance-evidence.v1';
  readonly generatedAt: UtcInstant;
  readonly readOnly: true;
  readonly grantsExecutionAuthority: false;
  readonly grantsSigningAuthority: false;
  readonly kernelDecides: true;
  readonly items: readonly {
    readonly evidenceId: string;
    readonly classification: string;
    readonly providerId: string;
    readonly matchType: string;
    readonly summary: string;
    readonly label: 'COMPLIANCE_EVIDENCE_NOT_DECISION';
  }[];
};

export function evidenceToAgentItem(evidence: ComplianceEvidence): ComplianceAgentEvidence['items'][number] {
  return Object.freeze({
    evidenceId: evidence.evidenceId,
    classification: evidence.classification,
    providerId: evidence.source.providerId,
    matchType: evidence.match.matchType,
    summary: `${evidence.classification} ${evidence.match.matchType} via ${evidence.source.listName ?? evidence.source.providerId}`,
    label: 'COMPLIANCE_EVIDENCE_NOT_DECISION',
  });
}

export async function buildComplianceAgentEvidence(
  service: ComplianceScreeningEvidenceService,
  input: {
    readonly name: string;
    readonly subjectRef: string;
    readonly nowUtc: UtcInstant;
  },
): Promise<ComplianceAgentEvidence> {
  const evidence = await service.screenPerson({
    name: input.name,
    canonicalSubjectId: input.subjectRef,
    nowUtc: input.nowUtc,
  });
  const proof = complianceSeparationProof();
  return Object.freeze({
    schema: 'sunrey.agent.compliance-evidence.v1',
    generatedAt: input.nowUtc,
    readOnly: true,
    grantsExecutionAuthority: proof.issuesExecutionAuthority,
    grantsSigningAuthority: false,
    kernelDecides: true,
    items: Object.freeze(
      evidence
        .filter((e) => e.match.matchType !== 'NEGATIVE_OBSERVATION')
        .map((e) => evidenceToAgentItem(e)),
    ),
  });
}
