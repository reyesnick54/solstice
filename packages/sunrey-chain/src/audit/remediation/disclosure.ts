import type { DisclosureClass, ExternalSecurityFinding, PublicFindingView } from './types.ts';

const PUBLIC_SAFE_DESCRIPTION = 'Details withheld under SECURITY_RESTRICTED disclosure policy.';

export function publicFindingView(finding: ExternalSecurityFinding): PublicFindingView {
  const restricted = finding.disclosureClass === 'SECURITY_RESTRICTED';
  return Object.freeze({
    findingId: finding.findingId,
    title: finding.title,
    status: finding.status,
    externalSeverity: finding.externalSeverity,
    internalEngineeringSeverity: finding.internalEngineeringSeverity,
    affectedSurface: finding.affectedSurface,
    disclosureClass: finding.disclosureClass,
    exploitDetailExposed: false,
    description: restricted ? PUBLIC_SAFE_DESCRIPTION : finding.descriptionReference,
  });
}

export function publicPayloadExposesExploitDetail(
  payload: string,
  disclosureClass: DisclosureClass,
): boolean {
  if (disclosureClass !== 'SECURITY_RESTRICTED') {
    return false;
  }
  return /exploit|poc|payload|proof.of.concept/i.test(payload);
}

export function assertPublicSafe(payload: string, disclosureClass: DisclosureClass): void {
  if (publicPayloadExposesExploitDetail(payload, disclosureClass)) {
    throw new Error('restricted exploit detail must not be exposed publicly');
  }
}
