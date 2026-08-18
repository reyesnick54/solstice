import type { ExternalSecurityFinding, SecurityRiskAcceptance } from './types.ts';
import type { KnownSecurityLimitation } from '../types.ts';

/**
 * Unresolved accepted findings flow into KnownSecurityLimitations,
 * release notes, mainnet readiness, and the audit bundle according
 * to disclosure policy.
 */
export function limitationsFromAcceptedRisks(
  findings: readonly ExternalSecurityFinding[],
  accepted: readonly SecurityRiskAcceptance[],
): readonly KnownSecurityLimitation[] {
  return Object.freeze(accepted.map((row) => {
    const finding = findings.find((item) => item.findingId === row.findingId);
    return Object.freeze({
      limitation_id: `LIM-ACCEPTED-${row.findingId}`,
      subsystem: finding?.affectedSurface ?? 'audit-remediation',
      description: finding
        ? `${finding.title} accepted under ${row.acceptanceId}: ${row.reason}`
        : row.reason,
      riskClassification: finding?.internalEngineeringSeverity === 'CRITICAL'
        ? 'CRITICAL'
        : finding?.internalEngineeringSeverity === 'HIGH'
          ? 'HIGH'
          : 'MEDIUM',
      temporaryMitigation: row.compensatingControls.join('; '),
      plannedRemediation: `Review by ${row.expirationOrReviewDateUtc}`,
      externalDependency: row.humanSecurityAuthority,
      status: 'ACCEPTED_WITH_HUMAN_APPROVAL',
    } satisfies KnownSecurityLimitation);
  }));
}

export function rcLimitationsFromAcceptedRisks(
  findings: readonly ExternalSecurityFinding[],
  accepted: readonly SecurityRiskAcceptance[],
): readonly { readonly id: string; readonly title: string; readonly severity: 'critical' | 'warning' | 'info'; readonly source: string; readonly hiddenFromReleaseNotes: false }[] {
  return Object.freeze(accepted.map((row) => {
    const finding = findings.find((item) => item.findingId === row.findingId);
    const severity = finding?.internalEngineeringSeverity === 'CRITICAL'
      ? 'critical'
      : finding?.internalEngineeringSeverity === 'HIGH'
        ? 'warning'
        : 'info';
    return Object.freeze({
      id: `ACCEPTED_${row.findingId}`,
      title: finding ? `${finding.title} (${row.reason})` : row.reason,
      severity,
      source: 'chunk-83',
      hiddenFromReleaseNotes: false as const,
    });
  }));
}
