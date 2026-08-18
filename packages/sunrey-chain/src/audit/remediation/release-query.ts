import { isOpenFinding } from './finding.ts';
import { effectiveSeverity, isCriticalBlocker, isHighReleaseIssue } from './policy.ts';
import type {
  ExternalSecurityFinding,
  ProductionSecurityPolicy,
  ReleaseSecurityQuery,
  SecurityRiskAcceptance,
} from './types.ts';

/**
 * Chunk 59/78 release tooling query. Mainnet qualification later
 * reads open critical/high findings, accepted risks, and retest state.
 */
export function queryReleaseSecurityState(input: {
  readonly findings: readonly ExternalSecurityFinding[];
  readonly acceptedRisks: readonly SecurityRiskAcceptance[];
  readonly policy: ProductionSecurityPolicy;
}): ReleaseSecurityQuery {
  const openCritical = input.findings
    .filter((row) => isOpenFinding(row.status) && effectiveSeverity(row) === 'CRITICAL')
    .map((row) => row.findingId);
  const openHigh = input.findings
    .filter((row) => isOpenFinding(row.status) && effectiveSeverity(row) === 'HIGH')
    .map((row) => row.findingId);
  const pending = input.findings.filter((row) => row.status === 'REMEDIATED_PENDING_RETEST').length;
  const retested = input.findings.filter((row) => row.status === 'EXTERNALLY_RETESTED').length;
  return Object.freeze({
    openCriticalFindings: Object.freeze(openCritical),
    openHighFindings: Object.freeze(openHigh),
    acceptedRisks: Object.freeze(input.acceptedRisks.map((row) => row.acceptanceId)),
    externalRetestState: `pending=${pending};externally_retested=${retested}`,
    criticalIsMainnetBlocker: openCritical.some((id) => {
      const finding = input.findings.find((row) => row.findingId === id);
      return finding ? isCriticalBlocker(finding, input.policy) : false;
    }) || (openCritical.length > 0 && input.policy.criticalOpenFindingsBlockMainnet),
    highReleasePolicy: input.policy.highOpenFindingsPolicy,
    claimsExternalAuditCompleted: false,
  });
}

export function highFindingsRequireExplicitPolicy(
  findings: readonly ExternalSecurityFinding[],
  policy: ProductionSecurityPolicy,
): boolean {
  return findings.some((row) => isHighReleaseIssue(row, policy)) && policy.humanApproved;
}
