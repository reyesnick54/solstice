/**
 * Deterministic genesis eligibility and external-blocker evaluation.
 *
 * Even GENESIS_AUTHORIZATION_PACKAGE_COMPLETE does not run production
 * infrastructure.
 */

import { consumeLegalRegulatory } from '../mainnet/consumers.ts';
import {
  consumeAuditEvidence,
  consumeCandidateV2,
  consumeMainnetRc,
  consumeProviderAcceptance,
  type ArtifactBinding,
  type AuditBinding,
  type ProviderAcceptanceBinding,
} from './bindings.ts';
import { rehearsalIdentityUnusableForProduction } from './identity.ts';
import type {
  ExternalBlocker,
  GenesisEligibilityState,
  ProductionGenesisAuthorizationPackage,
  ProductionGenesisCeremonyPlan,
  ProductionValidatorAcceptance,
} from './types.ts';

export type EligibilityInput = {
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly candidateV2: ArtifactBinding;
  readonly mainnetRc: ArtifactBinding;
  readonly provider: ProviderAcceptanceBinding;
  readonly audit: AuditBinding;
  readonly acceptances: readonly ProductionValidatorAcceptance[];
  readonly allocationAuthorized: boolean;
  readonly transcriptVerified: boolean;
  readonly humanApprovals: readonly string[];
  readonly requireRealHsm: boolean;
  readonly authorization: ProductionGenesisAuthorizationPackage | null;
};

export function collectExternalBlockers(input: EligibilityInput): readonly ExternalBlocker[] {
  const blockers: ExternalBlocker[] = [];
  const legal = consumeLegalRegulatory();
  if (!input.candidateV2.present || input.candidateV2.hash === null) {
    blockers.push({
      code: 'MISSING_CANDIDATE_V2',
      present: true,
      detail: input.candidateV2.notes,
    });
  }
  if (!input.mainnetRc.present || input.mainnetRc.hash === null) {
    blockers.push({
      code: 'MISSING_MAINNET_RC',
      present: true,
      detail: input.mainnetRc.notes,
    });
  }
  if (input.audit.externalReviewStatus !== 'HUMAN_VERIFIED') {
    blockers.push({
      code: 'MISSING_EXTERNAL_SECURITY_REVIEW',
      present: true,
      detail: input.audit.notes,
    });
  }
  if (input.audit.openCritical.length > 0) {
    blockers.push({
      code: 'OPEN_CRITICAL_SECURITY_BLOCKER',
      present: true,
      detail: input.audit.openCritical.join(','),
    });
  }
  if (input.audit.openHigh.length > 0) {
    blockers.push({
      code: 'OPEN_HIGH_SECURITY_BLOCKER',
      present: true,
      detail: input.audit.openHigh.join(','),
    });
  }
  if (input.requireRealHsm) {
    blockers.push({
      code: 'MISSING_HSM_EVIDENCE',
      present: true,
      detail: 'Configured production policy requires real HSM evidence. Simulation attestation is labeled and insufficient.',
    });
  }
  if (legal.licenseOrRegistration === null) {
    blockers.push({
      code: 'MISSING_LICENSE',
      present: true,
      detail: 'License or registration evidence remains missing.',
    });
  }
  if (legal.counselOpinionReference === null || legal.confirmedByCounsel === false) {
    blockers.push({
      code: 'MISSING_LEGAL_APPROVAL',
      present: true,
      detail: legal.notes,
    });
  }
  if (input.provider.productionEligible === false) {
    blockers.push({
      code: 'MISSING_PROVIDER_AGREEMENT',
      present: true,
      detail: input.provider.notes,
    });
  }
  if (input.plan.environmentClass === 'PRODUCTION' || input.humanApprovals.length < input.plan.requiredApprovals) {
    blockers.push({
      code: 'MISSING_HUMAN_AUTHORIZATION',
      present: true,
      detail: 'Required multi-person human authorization for production genesis is absent.',
    });
  }
  if (!input.allocationAuthorized && input.plan.environmentClass === 'PRODUCTION') {
    blockers.push({
      code: 'UNAPPROVED_ASSET_ALLOCATION',
      present: true,
      detail: 'Production genesis allocation remains unapproved. Quantities are not invented. Rehearsal allocation is not copied.',
    });
  }
  if (input.acceptances.some((row) => row.rejectionReason?.includes('fixture'))) {
    blockers.push({
      code: 'FIXTURE_VALIDATOR_NOT_GENESIS_ELIGIBLE',
      present: true,
      detail: 'Fixture validators can never become GENESIS_ELIGIBLE.',
    });
  }
  if (input.requireRealHsm || input.plan.environmentClass === 'PRODUCTION') {
    blockers.push({
      code: 'SIMULATION_HSM_NOT_PRODUCTION',
      present: true,
      detail: 'Simulation HSM cannot satisfy an external production HSM requirement.',
    });
  }
  blockers.push({
    code: 'TICKERS_NOT_ASSIGNED',
    present: true,
    detail: 'Tickers remain NOT_ASSIGNED. Ticker assignment is not required for protocol genesis when canonical IDs are sufficient.',
  });
  return Object.freeze(blockers);
}

export function evaluateGenesisEligibility(input: EligibilityInput): GenesisEligibilityState {
  if (input.plan.environmentClass === 'PRODUCTION') {
    if (!input.candidateV2.present || !input.mainnetRc.present || !input.allocationAuthorized) {
      return 'GENESIS_PACKAGE_INCOMPLETE';
    }
  }
  const blockers = collectExternalBlockers(input);
  const engineeringReady =
    input.transcriptVerified &&
    input.plan.cryptoPolicyHash.length > 0 &&
    (input.plan.environmentClass === 'DRESS_REHEARSAL' || (input.candidateV2.present && input.mainnetRc.present));
  if (!engineeringReady) {
    return 'GENESIS_PACKAGE_INCOMPLETE';
  }
  const external = blockers.filter(
    (row) =>
      row.code === 'MISSING_EXTERNAL_SECURITY_REVIEW' ||
      row.code === 'MISSING_HSM_EVIDENCE' ||
      row.code === 'MISSING_LEGAL_APPROVAL' ||
      row.code === 'MISSING_LICENSE' ||
      row.code === 'MISSING_PROVIDER_AGREEMENT' ||
      row.code === 'OPEN_CRITICAL_SECURITY_BLOCKER' ||
      row.code === 'OPEN_HIGH_SECURITY_BLOCKER',
  );
  if (input.plan.environmentClass === 'PRODUCTION' && external.length > 0) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (input.plan.environmentClass === 'PRODUCTION') {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  if (
    input.authorization &&
    input.authorization.usableForProduction === false &&
    input.humanApprovals.length >= input.plan.requiredApprovals &&
    input.transcriptVerified
  ) {
    return 'GENESIS_AUTHORIZATION_PACKAGE_COMPLETE';
  }
  if (input.humanApprovals.length < input.plan.requiredApprovals) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  return 'GENESIS_ENGINEERING_READY';
}

export function evaluateCurrentProductionState(root = process.cwd()): {
  readonly candidateV2: ArtifactBinding;
  readonly mainnetRc: ArtifactBinding;
  readonly provider: ProviderAcceptanceBinding;
  readonly audit: AuditBinding;
  readonly eligibility: GenesisEligibilityState;
  readonly blockers: readonly ExternalBlocker[];
} {
  const candidateV2 = consumeCandidateV2(root);
  const mainnetRc = consumeMainnetRc(root);
  const provider = consumeProviderAcceptance(root);
  const audit = consumeAuditEvidence(root);
  const plan = {
    requiredApprovals: 4,
    environmentClass: 'PRODUCTION' as const,
    cryptoPolicyHash: 'pending',
  };
  const input: EligibilityInput = {
    plan: {
      schemaVersion: 1,
      planId: 'plan.sunrey.production-genesis.v1',
      planVersion: 1,
      environmentClass: 'PRODUCTION',
      mainnetRcId: mainnetRc.id,
      mainnetRcHash: mainnetRc.hash ?? '',
      candidateV2Id: candidateV2.id,
      candidateV2RootHash: candidateV2.hash ?? '',
      protocolVersion: '1',
      economicBundleHash: '',
      cryptoPolicyId: '',
      cryptoPolicyHash: '',
      validatorCandidateSetHash: '',
      governanceAuthorityId: '',
      releaseAuthorityId: '',
      genesisAuthorityId: '',
      networkId: '',
      chainId: '',
      addressHrp: '',
      allocationManifestHash: '',
      requiredHumanRoles: ['GENESIS_AUTHORITY', 'PROTOCOL_AUTHORITY', 'SECURITY_AUTHORITY', 'RELEASE_AUTHORITY'],
      requiredApprovals: plan.requiredApprovals,
      genesisTimePolicy: {
        procedureId: 'sunrey.genesis-time.governed.v1',
        state: 'PROCEDURE_DEFINED',
        selectedUnixMs: null,
        selectedUtc: null,
        usesDeveloperLocalClock: false,
        notes: '',
      },
      usableForProduction: false,
      realProductionKeysCreated: false,
      mainnetEnabled: false,
    },
    candidateV2,
    mainnetRc,
    provider,
    audit,
    acceptances: [],
    allocationAuthorized: false,
    transcriptVerified: false,
    humanApprovals: [],
    requireRealHsm: true,
    authorization: null,
  };
  return Object.freeze({
    candidateV2,
    mainnetRc,
    provider,
    audit,
    eligibility: evaluateGenesisEligibility(input),
    blockers: collectExternalBlockers(input),
  });
}

export function rejectDressRehearsalAsProduction(value: string): void {
  if (rehearsalIdentityUnusableForProduction(value)) {
    throw new TypeError('dress-rehearsal authorization unusable for production');
  }
}
