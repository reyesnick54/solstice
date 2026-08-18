import { mapExternalSeverity } from './severity.ts';
import type {
  ExternalSecurityFinding,
  FindingSeverity,
  ProductionSecurityPolicy,
} from './types.ts';
import { isOpenFinding } from './finding.ts';

export const DEFAULT_PRODUCTION_SECURITY_POLICY: ProductionSecurityPolicy = Object.freeze({
  criticalOpenFindingsBlockMainnet: true,
  highOpenFindingsPolicy: 'BLOCK_PRODUCTION',
  informationalFindingsBlockMainnet: false,
  humanApproved: false,
  approvedBy: null,
});

export function approveProductionSecurityPolicy(
  policy: Omit<ProductionSecurityPolicy, 'humanApproved' | 'approvedBy'>,
  approvedBy: string,
): ProductionSecurityPolicy {
  if (!approvedBy.trim()) {
    throw new Error('production security policy requires human approval');
  }
  return Object.freeze({
    ...policy,
    informationalFindingsBlockMainnet: false,
    humanApproved: true,
    approvedBy,
  });
}

export function effectiveSeverity(finding: ExternalSecurityFinding): FindingSeverity | null {
  return finding.internalEngineeringSeverity ?? mapExternalSeverity(finding.externalSeverity);
}

export function isCriticalBlocker(
  finding: ExternalSecurityFinding,
  policy: ProductionSecurityPolicy = DEFAULT_PRODUCTION_SECURITY_POLICY,
): boolean {
  if (!isOpenFinding(finding.status)) {
    return false;
  }
  return policy.criticalOpenFindingsBlockMainnet && effectiveSeverity(finding) === 'CRITICAL';
}

export function isHighReleaseIssue(
  finding: ExternalSecurityFinding,
  policy: ProductionSecurityPolicy = DEFAULT_PRODUCTION_SECURITY_POLICY,
): boolean {
  if (!isOpenFinding(finding.status)) {
    return false;
  }
  if (effectiveSeverity(finding) !== 'HIGH') {
    return false;
  }
  return policy.highOpenFindingsPolicy !== 'TRACK_ONLY';
}

export function informationalIsBlocker(
  finding: ExternalSecurityFinding,
  policy: ProductionSecurityPolicy = DEFAULT_PRODUCTION_SECURITY_POLICY,
): boolean {
  return policy.informationalFindingsBlockMainnet && effectiveSeverity(finding) === 'INFORMATIONAL';
}
