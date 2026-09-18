/**
 * HELIOS H36 — Evidence Vault sealing for release evidence and pilot gate outcomes.
 */

import type { EvidenceVault } from '@solstice/evidence';
import type {
  HELIOSReleaseEvidencePackage,
  HeliosClosureReport,
  LivePilotAuthorization,
  LivePilotGate,
} from './types.ts';

export function sealHeliosReleaseEvidencePackage(
  vault: EvidenceVault | undefined,
  pkg: HELIOSReleaseEvidencePackage,
): void {
  vault?.seal('HELIOS_RELEASE_EVIDENCE_PACKAGE', {
    schema: pkg.schema,
    packageHash: pkg.packageHash,
    releaseId: pkg.identity.releaseId,
    gitSha: pkg.identity.gitSha,
    artifactDigest: pkg.identity.artifactDigest,
    engineeringQualified: pkg.engineering.engineeringQualified,
    environment: pkg.identity.environment,
    sealedAt: pkg.sealedAt,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
    activatesLiveConnectivity: false,
  });
}

export function sealLivePilotGateEvaluation(
  vault: EvidenceVault | undefined,
  gate: LivePilotGate,
): void {
  vault?.seal('HELIOS_LIVE_PILOT_GATE_EVALUATION', {
    schema: gate.schema,
    scopeId: gate.scope.scopeId,
    releaseId: gate.releaseId,
    releaseGitSha: gate.releaseGitSha,
    allGatesSatisfied: gate.allGatesSatisfied,
    missingExternalEvidence: gate.missingExternalEvidence,
    evaluatedAt: gate.evaluatedAt,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
    activatesLiveConnectivity: false,
  });
}

export function sealLivePilotAuthorizationRecord(
  vault: EvidenceVault | undefined,
  authorization: LivePilotAuthorization,
): void {
  vault?.seal('HELIOS_LIVE_PILOT_AUTHORIZATION_RECORD', {
    schema: authorization.schema,
    authorizationId: authorization.authorizationId,
    releaseId: authorization.releaseId,
    releaseGitSha: authorization.releaseGitSha,
    jurisdiction: authorization.jurisdiction,
    approvedAt: authorization.approvedAt,
    effectiveFrom: authorization.effectiveFrom,
    expiresAt: authorization.expiresAt,
    aiSigned: authorization.aiSigned,
    activatesLiveConnectivity: authorization.activatesLiveConnectivity,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
}

export function sealHeliosClosureReport(
  vault: EvidenceVault | undefined,
  report: HeliosClosureReport,
): void {
  vault?.seal('HELIOS_H01_H36_CLOSURE_REPORT', {
    schema: report.schema,
    releaseSha: report.releaseSha,
    releaseCandidateStatus: report.releaseCandidateStatus,
    generatedAt: report.generatedAt,
    pilotEligibility: report.pilotEligibility,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
    activatesLiveConnectivity: false,
  });
}
