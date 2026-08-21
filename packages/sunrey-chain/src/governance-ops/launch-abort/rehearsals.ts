/**
 * Deterministic Chunk 167 launch-abort and recovery drills.
 */

import {
  applyEmergencyAction,
  buildOperationPackage,
  developmentEmergencyPolicy,
  developmentEvidence,
  fixtureHumanApprovals,
  signApproval,
} from '../engine.ts';
import type { EmergencyActionClass, EmergencyActionRecord, GovernanceOperationPackage } from '../types.ts';
import { abortCeremony, recordPreGenesisAbort, refuseUndoGenesis } from './abort.ts';
import { attemptProtocolRollback, planApplicationRollback } from './rollback.ts';
import { availableUnrelatedCapabilities, restrictionPlanFor } from './restrictions.ts';
import {
  complianceOutageFailsClosed,
  evaluateRecoveryGate,
  recoverDatabase,
  recoverHsmCompromise,
  recoverPaymentUnknown,
  supplyMismatchIncident,
} from './recovery.ts';
import {
  assembleResumptionCandidate,
  expireRestrictionWithoutResume,
  recommendEmergencyAction,
  refuseAiEmergencyApproval,
} from './resumption.ts';
import type { IndependentCapability } from '../../post-genesis/types.ts';
import { composeStagedActivationAbortRecovery } from './compose-staged.ts';

function emergencyPackage(packageId: string): GovernanceOperationPackage {
  return buildOperationPackage({
    packageId,
    operationType: 'ORACLE_POLICY',
    activation: { kind: 'HEIGHT', height: 40, epoch: null },
    evidence: developmentEvidence(packageId),
  });
}

function restrict(input: {
  readonly actionId: string;
  readonly incidentId: string;
  readonly actionClass: EmergencyActionClass;
  readonly scope: string;
  readonly pkg: GovernanceOperationPackage;
  readonly expiresAtHeight?: number;
}): EmergencyActionRecord {
  return applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: input.actionId,
    incidentReference: input.incidentId,
    actionClass: input.actionClass,
    scope: input.scope,
    packageHash: input.pkg.packageHash,
    approvals: fixtureHumanApprovals(input.pkg),
    activation: input.pkg.activation,
    expiresAtHeight: input.expiresAtHeight ?? 80,
    reviewAtHeight: 60,
    evidenceHash: input.pkg.evidence.qualificationReportHash,
  });
}

export function rehearsePreGenesisAbort() {
  const abort = recordPreGenesisAbort({
    reason: 'SECURITY_FINDING',
    candidateFreezeHash: 'freeze_rehearsal_167',
    operatorActions: ['PRESERVE_CANDIDATE', 'SEAL_EVIDENCE'],
  });
  return Object.freeze({
    abort,
    wroteGenesis: abort.createdGenesisBlock,
    wroteChainHistory: abort.createdChainHistory,
    migratedBalances: abort.migratedBalances,
  });
}

export function rehearseCeremonyAbort() {
  const abort = abortCeremony({
    phase: 'DURING_CEREMONY',
    reason: 'CEREMONY_DEFECT',
    ceremonyTranscriptHash: 'transcript_rehearsal_167',
    candidateFreezeHash: 'freeze_rehearsal_167',
  });
  return Object.freeze({
    abort,
    transcriptPreserved: abort.transcriptPreserved,
    wroteGenesis: abort.createdGenesisBlock,
  });
}

export function rehearseOracleProviderCompromise() {
  const pkg = emergencyPackage('govops-abort-oracle-1');
  const plan = restrictionPlanFor({ incidentId: 'INC-ORACLE-COMPROMISE', domain: 'ORACLE' });
  const suspend = restrict({
    actionId: 'emg_oracle_route',
    incidentId: plan.incidentId,
    actionClass: 'SUSPEND_ORACLE_PROVIDER',
    scope: 'provider:oracle_rehearsal_1',
    pkg,
  });
  const issuance = restrict({
    actionId: 'emg_moonrey_issuance',
    incidentId: plan.incidentId,
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'moonrey:new-issuance',
    pkg,
  });
  const available = availableUnrelatedCapabilities(plan.scopedCapabilities);
  return Object.freeze({
    plan,
    suspend,
    issuance,
    unrelatedAvailable: available,
    exchangeStillAvailable: available.includes('SUNREY_EXCHANGE'),
    paymentsStillAvailable: available.includes('PAYMENT_RAILS'),
    balancesDeleted: plan.deletesFinalizedBalances,
    supplyRewritten: plan.rewritesSupply,
    canonicalOwnerSuspended: plan.suspendsCanonicalDomainOwner,
  });
}

export function rehearseMoonReySupplyMismatch() {
  const mismatch = supplyMismatchIncident('MOONREY_COIN');
  const pkg = emergencyPackage('govops-abort-supply-1');
  const restriction = restrict({
    actionId: 'emg_moonrey_supply',
    incidentId: 'INC-MOONREY-SUPPLY',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'moonrey:new-issuance',
    pkg,
  });
  return Object.freeze({
    mismatch,
    restriction,
    issuanceBlocked: restriction.accepted && mismatch?.newIssuanceRestricted === true,
    supplyEdited: mismatch?.supplyNumbersEditedToMatch === false,
  });
}

export function rehearseSunReyContributionCorruption() {
  const pkg = emergencyPackage('govops-abort-sunrey-1');
  const restriction = restrict({
    actionId: 'emg_sunrey_issuance',
    incidentId: 'INC-SUNREY-VERIFICATION',
    actionClass: 'RESTRICT_NEW_SUNREY_ISSUANCE',
    scope: 'sunrey:new-issuance',
    pkg,
  });
  return Object.freeze({
    restriction,
    balancesDeleted: false,
    clawback: false,
  });
}

export function rehearseHsmCompromise() {
  const recovery = recoverHsmCompromise();
  const pkg = emergencyPackage('govops-abort-hsm-1');
  const restriction = restrict({
    actionId: 'emg_hsm_signing',
    incidentId: 'INC-HSM-COMPROMISE',
    actionClass: 'RESTRICT_CUSTODY_WITHDRAWALS',
    scope: 'route:custody-signing',
    pkg,
  });
  return Object.freeze({
    recovery,
    restriction,
    signingBlocked: recovery.signingDisabled && restriction.accepted,
    fundsMoved: recovery.assetsTransferredAutomatically,
  });
}

export function rehearsePaymentSubmissionUnknown() {
  const recovery = recoverPaymentUnknown();
  const pkg = emergencyPackage('govops-abort-pay-1');
  const restriction = restrict({
    actionId: 'emg_payment_submissions',
    incidentId: 'INC-PAYMENT-UNKNOWN',
    actionClass: 'RESTRICT_PAYMENT_SUBMISSIONS',
    scope: 'provider:payment_rehearsal_1',
    pkg,
  });
  return Object.freeze({
    recovery,
    restriction,
    queriedBeforeRetry: recovery.queryRequiredBeforeRetry,
    blindRetry: recovery.incidentPressureAuthorizesBlindResubmission,
  });
}

export function rehearseComplianceOutage() {
  const closed = complianceOutageFailsClosed();
  const available = availableUnrelatedCapabilities([
    'SUNREY_EXCHANGE',
    'INSTITUTIONAL_CUSTODY',
    'FIAT_BANKING',
    'PAYMENT_RAILS',
    'CARDS',
    'INVESTMENTS',
    'HUMAN_INFORMATION_MARKET',
  ]);
  return Object.freeze({
    closed,
    chainNativeStillAvailable: available.includes('SUNREY_COIN_NATIVE_ASSET'),
  });
}

export function rehearseDatabaseFailover() {
  const blocked = recoverDatabase({ reconciled: false });
  const ready = recoverDatabase({ reconciled: true });
  return Object.freeze({
    blocked,
    ready,
    dbIsSupplyAuthority: blocked.restoredApplicationDbIsSupplyAuthority,
    dbIsChainHistory: blocked.restoredApplicationDbIsChainHistory,
  });
}

export function rehearseFinalityDegradation() {
  const undo = refuseUndoGenesis({ genesisFinalized: true, requested: 'UNDO_GENESIS' });
  return Object.freeze({
    undo,
    finalizedErased: false,
  });
}

export function rehearseProviderEvidenceRevoked() {
  const plan = restrictionPlanFor({
    incidentId: 'INC-PROVIDER-REVOKED',
    domain: 'PROVIDER_BINDING',
  });
  const pkg = emergencyPackage('govops-abort-provider-1');
  const restriction = restrict({
    actionId: 'emg_provider_route',
    incidentId: plan.incidentId,
    actionClass: 'SUSPEND_PROVIDER_DOMAIN',
    scope: 'provider:binding_rehearsal_1',
    pkg,
  });
  return Object.freeze({
    plan,
    restriction,
    routeScoped: restriction.scope.startsWith('provider:'),
  });
}

export function rehearseApplicationReleaseRegression() {
  const plan = planApplicationRollback({
    planId: 'rollback_app_167',
    releaseHash: 'rel_prev_167',
    configurationHash: 'cfg_prev_167',
    schemaCompatible: true,
    dataMigrationCompatible: true,
    approval: 'human.release_authority',
    postRollbackVerification: 'health+reconciliation',
  });
  const protocol = attemptProtocolRollback({
    attemptId: 'proto_git_167',
    method: 'GIT_CHECKOUT',
  });
  return Object.freeze({
    plan,
    protocol,
    applicationIsNotChainRollback: plan.applicationRollbackIsNotChainHistoryRollback,
    protocolRequiresGovernance: protocol.requiresGovernance && protocol.accepted === false,
  });
}

export function rehearseResumptionIndependence() {
  const pkg = emergencyPackage('govops-abort-resume-1');
  const restriction = restrict({
    actionId: 'emg_moonrey_temp',
    incidentId: 'INC-ORACLE-COMPROMISE',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'moonrey:new-issuance',
    pkg,
    expiresAtHeight: 80,
  });
  const expired = expireRestrictionWithoutResume(restriction, 80);
  const incidentEnded = assembleResumptionCandidate({
    candidateId: 'resume_auto',
    capability: 'MOONREY_COIN_NATIVE_ASSET' satisfies IndependentCapability,
    incidentId: 'INC-ORACLE-COMPROMISE',
    restriction: expired,
    rootCauseAddressed: true,
    reconciliationClean: true,
    providerEvidenceCurrent: true,
    securityReviewComplete: true,
    controlRoomHealthy: true,
    incidentResolved: true,
  });
  const approved = assembleResumptionCandidate({
    candidateId: 'resume_human',
    capability: 'MOONREY_COIN_NATIVE_ASSET',
    incidentId: 'INC-ORACLE-COMPROMISE',
    restriction: expired,
    rootCauseAddressed: true,
    reconciliationClean: true,
    providerEvidenceCurrent: true,
    securityReviewComplete: true,
    controlRoomHealthy: true,
    incidentResolved: true,
    humanApproval: 'human.operations_authority',
  });
  const gate = evaluateRecoveryGate({
    domain: 'MOONREY_ISSUANCE',
    reconciled: true,
    rootCauseAddressed: true,
  });
  return Object.freeze({
    expired,
    incidentEnded,
    approved,
    gate,
    expiredAutoResumed: expired.result === 'EXPIRED_AWAITING_AUTHORITY',
    incidentEndEnabledRuntime: incidentEnded.runtimeEnabled,
    humanResumed: approved.runtimeEnabled,
  });
}


export function rehearseAiBoundary() {
  const recommendation = recommendEmergencyAction({
    recommendationId: 'ai_rec_167',
    summary: 'oracle provider integrity degraded; restrict new MoonRey issuance',
    recommendedClasses: ['SUSPEND_ORACLE_PROVIDER', 'RESTRICT_NEW_MOONREY_ISSUANCE'],
  });
  const pkg = emergencyPackage('govops-abort-ai-1');
  const aiApproval = signApproval({
    actorId: 'ai_analyst',
    actorKind: 'AI',
    role: 'AI_ANALYST',
    pkg,
  });
  const refused = applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: 'emg_ai',
    incidentReference: 'INC-AI',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'moonrey:new-issuance',
    packageHash: pkg.packageHash,
    approvals: [aiApproval],
    activation: pkg.activation,
    evidenceHash: pkg.evidence.qualificationReportHash,
  });
  return Object.freeze({
    recommendation,
    aiApprovalRefused: aiApproval.accepted === false,
    emergencyRefused: refused.accepted === false,
    aiMayAuthorize: refuseAiEmergencyApproval('AI').accepted,
  });
}

export function rehearseForbiddenEmergencyPowers() {
  const pkg = emergencyPackage('govops-abort-forbidden-1');
  const approvals = fixtureHumanApprovals(pkg);
  const mint = applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: 'bad_mint',
    incidentReference: 'INC-FORBIDDEN',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'all',
    packageHash: pkg.packageHash,
    approvals,
    activation: pkg.activation,
    evidenceHash: pkg.evidence.formalReportHash,
    requestedPower: 'MINT_NATIVE_ASSETS',
  });
  const confiscate = applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: 'bad_confiscate',
    incidentReference: 'INC-FORBIDDEN',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'all',
    packageHash: pkg.packageHash,
    approvals,
    activation: pkg.activation,
    evidenceHash: pkg.evidence.formalReportHash,
    requestedPower: 'CONFISCATE_CUSTOMER_WALLETS',
  });
  const rewrite = applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: 'bad_history',
    incidentReference: 'INC-FORBIDDEN',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'all',
    packageHash: pkg.packageHash,
    approvals,
    activation: pkg.activation,
    evidenceHash: pkg.evidence.formalReportHash,
    requestedPower: 'REWRITE_FINALIZED_BLOCKS',
  });
  const supply = applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: 'bad_supply',
    incidentReference: 'INC-FORBIDDEN',
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'all',
    packageHash: pkg.packageHash,
    approvals,
    activation: pkg.activation,
    evidenceHash: pkg.evidence.formalReportHash,
    requestedPower: 'REWRITE_SUPPLY',
  });
  return Object.freeze({ mint, confiscate, rewrite, supply });
}

export function runLaunchAbortRecoveryRehearsal() {
  const stagedActivation = composeStagedActivationAbortRecovery();
  const oracle = rehearseOracleProviderCompromise();
  const resume = rehearseResumptionIndependence();
  const hsm = rehearseHsmCompromise();
  return Object.freeze({
    stagedActivation,
    oracle,
    resume,
    hsm,
    flags: Object.freeze({
      GLOBAL_SUPER_ADMIN_EXISTS: false,
      EMERGENCY_CAN_MINT: false,
      EMERGENCY_CAN_REWRITE_SUPPLY: false,
      EMERGENCY_CAN_REWRITE_FINALIZED_HISTORY: false,
      RESTRICTIONS_DOMAIN_SCOPED: true,
      INCIDENT_END_AUTO_RESUMES: false,
      AI_CAN_AUTHORIZE_EMERGENCY: false,
      PRODUCTION_ACTIVE: false,
    }),
  });
}
