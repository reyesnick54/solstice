/**
 * ProductionGenesisVerificationReport, LaunchAuthorizationDossier, and
 * CeremonyEvidenceBundle. The dossier does not execute a launch.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { planHash } from './plan.ts';
import type { ArtifactBinding } from './bindings.ts';
import type {
  CeremonyEvidenceBundle,
  ExternalBlocker,
  GenesisEligibilityState,
  LaunchAuthorizationDossier,
  ProductionGenesisAuthorizationPackage,
  ProductionGenesisCeremonyPlan,
  ProductionGenesisCeremonySession,
  ProductionGenesisVerificationReport,
} from './types.ts';

export function buildVerificationReport(input: {
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly session: ProductionGenesisCeremonySession;
  readonly candidateV2: ArtifactBinding;
  readonly mainnetRc: ArtifactBinding;
  readonly eligibility: GenesisEligibilityState;
  readonly blockers: readonly ExternalBlocker[];
  readonly transcriptVerified: boolean;
  readonly allocationStatus: 'UNAPPROVED' | 'REHEARSAL_ONLY' | 'APPROVED';
}): ProductionGenesisVerificationReport {
  return Object.freeze({
    schemaVersion: 1,
    planId: input.plan.planId,
    planVersion: input.plan.planVersion,
    environmentClass: input.plan.environmentClass,
    mainnetRcId: input.plan.mainnetRcId,
    mainnetRcHash: input.plan.mainnetRcHash,
    mainnetRcVerified: input.mainnetRc.verified && input.mainnetRc.hash === input.plan.mainnetRcHash,
    candidateV2Id: input.plan.candidateV2Id,
    candidateV2RootHash: input.plan.candidateV2RootHash,
    candidateV2Verified: input.candidateV2.verified && input.candidateV2.hash === input.plan.candidateV2RootHash,
    validatorCount: input.session.dossiers.length,
    validatorEvidenceStatus: input.session.acceptances,
    hsmStatus: input.session.attestations.every((row) => row.simulation)
      ? 'SIMULATION_ATTESTATION'
      : 'MIXED',
    cryptoPolicyId: input.plan.cryptoPolicyId,
    genesisAllocationStatus: input.allocationStatus,
    candidateHash: input.session.genesis?.genesisHash ?? '',
    transcriptIntegrity: input.transcriptVerified,
    externalBlockers: input.blockers,
    humanAuthorizationState:
      input.session.authorization && input.session.authorization.humanAuthorizationSet.length >= input.plan.requiredApprovals
        ? 'REHEARSAL_MULTI_PERSON_APPROVED'
        : 'INCOMPLETE',
    eligibility: input.eligibility,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
}

export function buildLaunchAuthorizationDossier(input: {
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly report: ProductionGenesisVerificationReport;
  readonly authorization: ProductionGenesisAuthorizationPackage | null;
  readonly blockers: readonly ExternalBlocker[];
}): LaunchAuthorizationDossier {
  const humanReadable = [
    '# SunRey Launch Authorization Dossier',
    '',
    'This dossier collects evidence required for a future launch decision.',
    'It does not execute a launch.',
    '',
    `Plan: ${input.plan.planId} v${input.plan.planVersion} (${input.plan.environmentClass})`,
    `Mainnet RC: ${input.report.mainnetRcId} verified=${input.report.mainnetRcVerified}`,
    `Candidate V2: ${input.report.candidateV2Id} verified=${input.report.candidateV2Verified}`,
    `Validators: ${input.report.validatorCount}`,
    `HSM: ${input.report.hsmStatus}`,
    `CryptoPolicy: ${input.report.cryptoPolicyId}`,
    `Allocation: ${input.report.genesisAllocationStatus}`,
    `Genesis hash: ${input.report.candidateHash}`,
    `Transcript integrity: ${input.report.transcriptIntegrity}`,
    `Eligibility: ${input.report.eligibility}`,
    `Human authorization: ${input.report.humanAuthorizationState}`,
    `realProductionKeysCreated=false`,
    `mainnetEnabled=false`,
    '',
    '## External blockers',
    ...input.blockers.map((row) => `- ${row.code}: ${row.detail}`),
  ].join('\n');
  return Object.freeze({
    schemaVersion: 1,
    title: 'SunRey Launch Authorization Dossier',
    executesLaunch: false,
    plan: input.plan,
    report: input.report,
    authorization: input.authorization,
    blockers: input.blockers,
    eligibility: input.report.eligibility,
    humanReadable,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
}

export function ceremonyEvidenceBundle(
  session: ProductionGenesisCeremonySession,
  dossier: LaunchAuthorizationDossier,
): CeremonyEvidenceBundle {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: session.sessionId,
    planHash: planHash(session.plan),
    transcriptHash: session.transcript.transcriptHash,
    genesisHash: session.genesis?.genesisHash ?? '',
    authorizationPackageHash: session.authorization
      ? sha256Hex(Buffer.concat([encodeString('sunrey.authz.package.v1'), encodeString(session.authorization.genesisHash)]))
      : null,
    dossierHash: sha256Hex(Buffer.from(dossier.humanReadable, 'utf8')),
    simulation: session.plan.environmentClass !== 'PRODUCTION',
    realProductionKeysCreated: false,
  });
}
