import { openComplianceCase, type ComplianceCase } from '../cases.ts';
import type { ComplianceFabric } from '../fabric.ts';
import { findingKindToCaseType, type NormalizedComplianceFinding } from './types.ts';
import { findingRequiresHumanAction } from './findings.ts';

export type FindingCaseLink = {
  readonly findingId: string;
  readonly caseId: string;
  readonly providerId: string;
  readonly subjectRef: string;
  readonly severity: NormalizedComplianceFinding['severity'];
  readonly opened: ComplianceCase;
};

export function openCaseFromFinding(
  fabric: ComplianceFabric,
  finding: NormalizedComplianceFinding,
  jurisdiction: string,
): FindingCaseLink | null {
  if (!findingRequiresHumanAction(finding)) {
    return null;
  }
  const caseType = findingKindToCaseType(finding.kind);
  if (!caseType) {
    return null;
  }
  const opened = openComplianceCase({
    caseType,
    reasonCodes: finding.reasonCodes,
    originRefs: [finding.findingId, finding.providerRef],
    subjectRef: finding.subjectRef,
    jurisdiction,
    createdAt: finding.observedAt,
    hardBlock: finding.matchState === 'CONFIRMED_MATCH' && finding.kind === 'SANCTIONS',
  });
  fabric.store.cases.set(opened.caseId, opened);
  return Object.freeze({
    findingId: finding.findingId,
    caseId: opened.caseId,
    providerId: finding.providerId,
    subjectRef: finding.subjectRef,
    severity: finding.severity,
    opened,
  });
}
