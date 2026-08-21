import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../packages/config/src/flags.ts';
import { bindFixtureCustodyCredential } from '../packages/custody/src/provider-candidate/auth.ts';
import { applyProviderCompromise } from '../packages/custody/src/provider-candidate/compromise.ts';
import { registerKmsKey } from '../packages/custody/src/provider-candidate/kms.ts';
import { decideRetry } from '../packages/payments/src/rail-retry.ts';
import { RECOVERY_AUTHORITY, assertDatabaseAuthorityBoundaries } from '../packages/persistence/src/production/recovery/authority.ts';
import { expectedTotal, observedTotal } from '../packages/sunrey-chain/src/economics/supply.ts';
import {
  applyEmergencyAction,
  developmentEmergencyPolicy,
} from '../packages/sunrey-chain/src/governance-ops/engine.ts';
import {
  AI_CAN_AUTHORIZE_EMERGENCY,
  APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK as LAUNCH_ABORT_APP_NOT_CHAIN,
  EMERGENCY_CAN_CONFISCATE,
  EMERGENCY_CAN_MINT,
  EMERGENCY_CAN_REWRITE_FINALIZED_HISTORY,
  EMERGENCY_CAN_REWRITE_SUPPLY,
  GLOBAL_SUPER_ADMIN_EXISTS,
  INCIDENT_END_AUTO_RESUMES,
  PRODUCTION_ACTIVE,
  RESTRICTIONS_DOMAIN_SCOPED,
  abortCeremony,
  assembleResumptionCandidate,
  attemptProtocolRollback,
  availableUnrelatedCapabilities,
  composeStagedActivationAbortRecovery,
  expireRestrictionWithoutResume,
  mismatchedSupplyBook,
  planApplicationRollback,
  recommendEmergencyAction,
  recordPreGenesisAbort,
  recoverDatabase,
  recoverHsmCompromise,
  recoverPaymentUnknown,
  refuseUndoGenesis,
  rehearseAiBoundary,
  rehearseApplicationReleaseRegression,
  rehearseCeremonyAbort,
  rehearseComplianceOutage,
  rehearseDatabaseFailover,
  rehearseFinalityDegradation,
  rehearseForbiddenEmergencyPowers,
  rehearseHsmCompromise,
  rehearseMoonReySupplyMismatch,
  rehearseOracleProviderCompromise,
  rehearsePaymentSubmissionUnknown,
  rehearsePreGenesisAbort,
  rehearseProviderEvidenceRevoked,
  rehearseResumptionIndependence,
  rehearseSunReyContributionCorruption,
  restrictionPlanFor,
  runLaunchAbortRecoveryRehearsal,
  supplyMismatchIncident,
} from '../packages/sunrey-chain/src/governance-ops/launch-abort/index.ts';
import { APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK } from '../packages/sunrey-chain/src/production-handoff/types.ts';
import { planHandoffApplicationRollback, refuseProtocolHistoryRewrite } from '../packages/sunrey-chain/src/production-handoff/application-rollback.ts';
import { recoveryRequiresReconciliation } from '../packages/sunrey-chain/src/post-genesis/recovery-gates.ts';
import { buildOperationPackage, developmentEvidence, fixtureHumanApprovals } from '../packages/sunrey-chain/src/governance-ops/engine.ts';

const ROOT = join(import.meta.dirname, '..');

describe('CHUNK-167 launch abort and recovery', () => {
  it('1. pre-genesis abort writes no genesis', () => {
    const result = rehearsePreGenesisAbort();
    assert.equal(result.wroteGenesis, false);
    assert.equal(result.wroteChainHistory, false);
    assert.equal(result.migratedBalances, false);
    const abort = recordPreGenesisAbort({
      reason: 'OPERATOR_HOLD',
      candidateFreezeHash: 'freeze_test',
    });
    assert.equal(abort.createdGenesisBlock, false);
    assert.equal(abort.createdChainHistory, false);
    assert.equal(abort.migratedBalances, false);
  });

  it('2. ceremony abort preserves transcript', () => {
    const result = rehearseCeremonyAbort();
    assert.equal(result.transcriptPreserved, true);
    assert.equal(result.wroteGenesis, false);
    assert.equal(result.privateKeysReused, false);
    assert.equal(result.restartRequired, true);
    assert.equal(result.freezeHashBound, true);
    assert.equal(result.session.state, 'ABORTED');
    const abort = abortCeremony({
      phase: 'DURING_CEREMONY',
      reason: 'CEREMONY_DEFECT',
      ceremonyTranscriptHash: 'transcript_hash',
      candidateFreezeHash: 'freeze_hash',
    });
    assert.equal(abort.transcriptPreserved, true);
    assert.equal(abort.ceremonyTranscriptHash, 'transcript_hash');
  });

  it('3. finalized genesis cannot be erased', () => {
    const undo = refuseUndoGenesis({ genesisFinalized: true, requested: 'UNDO_GENESIS' });
    assert.equal(undo.accepted, false);
    assert.equal(undo.rejectionReason, 'FINALIZED_GENESIS_CANNOT_BE_ERASED');
    assert.equal(rehearseFinalityDegradation().finalizedErased, false);
  });

  it('4. application rollback is not chain rollback', () => {
    assert.equal(APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK, true);
    assert.equal(LAUNCH_ABORT_APP_NOT_CHAIN, true);
    const plan = planApplicationRollback({
      planId: 'rb1',
      releaseHash: 'rel',
      configurationHash: 'cfg',
      schemaCompatible: true,
      dataMigrationCompatible: true,
      approval: 'human',
      postRollbackVerification: 'ok',
    });
    assert.equal(plan.rewritesChainHistory, false);
    assert.equal(plan.applicationRollbackIsNotChainHistoryRollback, true);
    const record = planHandoffApplicationRollback({
      changeId: 'rb-handoff',
      releaseHash: 'rel',
      configurationHash: 'cfg',
      approval: 'human',
      verification: 'ok',
    });
    assert.equal(record.applicationRollbackIsChainHistoryRollback, false);
    assert.equal(rehearseApplicationReleaseRegression().applicationIsNotChainRollback, true);
  });

  it('5. protocol rollback requires governance', () => {
    const attempt = attemptProtocolRollback({ attemptId: 'p1', method: 'GIT_CHECKOUT' });
    assert.equal(attempt.accepted, false);
    assert.equal(attempt.rejectionReason, 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE');
    assert.equal(refuseProtocolHistoryRewrite().rejectionReason, 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE');
    assert.equal(rehearseApplicationReleaseRegression().protocolRequiresGovernance, true);
  });

  it('6. SunRey issuance can be restricted without deleting balances', () => {
    const result = rehearseSunReyContributionCorruption();
    assert.equal(result.restriction.accepted, true);
    assert.equal(result.restriction.actionClass, 'RESTRICT_NEW_SUNREY_ISSUANCE');
    assert.equal(result.balancesDeleted, false);
    assert.equal(result.clawback, false);
  });

  it('7. MoonRey issuance can be restricted without rewriting supply', () => {
    const result = rehearseOracleProviderCompromise();
    assert.equal(result.issuance.accepted, true);
    assert.equal(result.issuance.actionClass, 'RESTRICT_NEW_MOONREY_ISSUANCE');
    assert.equal(result.supplyRewritten, false);
  });

  it('8. supply mismatch blocks new issuance', () => {
    const book = mismatchedSupplyBook('MOONREY_COIN');
    assert.notEqual(expectedTotal(book), observedTotal(book));
    const mismatch = supplyMismatchIncident('MOONREY_COIN');
    assert.ok(mismatch);
    assert.equal(mismatch.severity, 'CRITICAL');
    assert.equal(mismatch.newIssuanceRestricted, true);
    assert.equal(mismatch.supplyNumbersEditedToMatch, false);
    const result = rehearseMoonReySupplyMismatch();
    assert.equal(result.issuanceBlocked, true);
    assert.equal(result.supplyEdited, true);
  });

  it('9. provider suspension is scoped', () => {
    const result = rehearseProviderEvidenceRevoked();
    assert.equal(result.restriction.accepted, true);
    assert.equal(result.routeScoped, true);
    assert.equal(result.plan.suspendsCanonicalDomainOwner, false);
    const oracle = rehearseOracleProviderCompromise();
    assert.equal(oracle.canonicalOwnerSuspended, false);
    assert.equal(oracle.suspend.scope.startsWith('provider:'), true);
  });

  it('10. HSM compromise blocks signing', () => {
    const recovery = recoverHsmCompromise();
    assert.equal(recovery.signingDisabled, true);
    assert.equal(recovery.signingRouteSuspended, true);
    const keyId = 'chunk167-test-hsm';
    registerKmsKey(keyId);
    const binding = bindFixtureCustodyCredential({ bindingId: `bind-${keyId}` });
    assert.equal(binding.ok, true);
    if (!binding.ok) return;
    const outcome = applyProviderCompromise({ keyId, binding: binding.value });
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.value.signingDisabled, true);
    }
    assert.equal(rehearseHsmCompromise().signingBlocked, true);
  });

  it('11. HSM compromise does not move funds', () => {
    const result = rehearseHsmCompromise();
    assert.equal(result.fundsMoved, false);
    assert.equal(result.recovery.assetsTransferredAutomatically, false);
  });

  it('12. payment ambiguity still queries before retry', () => {
    const recovery = recoverPaymentUnknown();
    assert.equal(recovery.queryRequiredBeforeRetry, true);
    assert.equal(recovery.incidentPressureAuthorizesBlindResubmission, false);
    const decision = decideRetry('SUBMIT', 'UNKNOWN', { executionUnknown: true });
    assert.equal(decision.allowed, false);
    assert.equal(decision.retryClass, 'DO_NOT_RETRY_WITHOUT_QUERY');
    assert.equal(rehearsePaymentSubmissionUnknown().blindRetry, false);
  });

  it('13. compliance outage fails closed', () => {
    const result = rehearseComplianceOutage();
    assert.equal(result.closed.failClosed, true);
    assert.equal(result.closed.regulatedActionsBlocked, true);
  });

  it('14. unrelated domain remains available in rehearsal', () => {
    const oracle = rehearseOracleProviderCompromise();
    assert.equal(oracle.exchangeStillAvailable, true);
    assert.equal(oracle.paymentsStillAvailable, true);
    const available = availableUnrelatedCapabilities(['MOONREY_COIN_NATIVE_ASSET']);
    assert.ok(available.includes('SUNREY_EXCHANGE'));
    assert.equal(restrictionPlanFor({ incidentId: 'x', domain: 'ORACLE' }).unrelatedCapabilitiesRemainAvailable, true);
  });

  it('15. recovery requires reconciliation', () => {
    const blocked = recoverDatabase({ reconciled: false });
    assert.equal(blocked.state, 'RECONCILIATION_REQUIRED');
    assert.equal(blocked.restoredApplicationDbIsSupplyAuthority, false);
    assert.equal(blocked.restoredApplicationDbIsChainHistory, false);
    assertDatabaseAuthorityBoundaries(RECOVERY_AUTHORITY);
    assert.equal(recoveryRequiresReconciliation(false).mayResumeConsequentialWorkflows, false);
    assert.equal(rehearseDatabaseFailover().dbIsSupplyAuthority, false);
  });

  it('16. resumption requires separate approval', () => {
    const result = rehearseResumptionIndependence();
    assert.equal(result.incidentEndEnabledRuntime, false);
    assert.equal(result.humanResumed, true);
    const pkg = buildOperationPackage({
      packageId: 'resume-sep',
      operationType: 'ORACLE_POLICY',
      activation: { kind: 'HEIGHT', height: 40, epoch: null },
      evidence: developmentEvidence('resume-sep'),
    });
    const restriction = applyEmergencyAction({
      policy: developmentEmergencyPolicy(),
      actionId: 'emg_sep',
      incidentReference: 'INC-SEP',
      actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
      scope: 'moonrey',
      packageHash: pkg.packageHash,
      approvals: fixtureHumanApprovals(pkg),
      activation: pkg.activation,
      evidenceHash: pkg.evidence.qualificationReportHash,
    });
    const candidate = assembleResumptionCandidate({
      candidateId: 'c1',
      capability: 'MOONREY_COIN_NATIVE_ASSET',
      incidentId: 'INC-SEP',
      restriction,
      rootCauseAddressed: true,
      reconciliationClean: true,
      providerEvidenceCurrent: true,
      securityReviewComplete: true,
      controlRoomHealthy: true,
      incidentResolved: true,
    });
    assert.equal(candidate.runtimeEnabled, false);
    assert.equal(candidate.incidentEndAutoResumed, false);
  });

  it('17. expired restriction does not auto-resume', () => {
    const result = rehearseResumptionIndependence();
    assert.equal(result.expiredAutoResumed, true);
    assert.equal(result.expired.result, 'EXPIRED_AWAITING_AUTHORITY');
    const pkg = buildOperationPackage({
      packageId: 'expire-1',
      operationType: 'ORACLE_POLICY',
      activation: { kind: 'HEIGHT', height: 40, epoch: null },
      evidence: developmentEvidence('expire-1'),
    });
    const action = applyEmergencyAction({
      policy: developmentEmergencyPolicy(),
      actionId: 'emg_exp',
      incidentReference: 'INC-EXP',
      actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
      scope: 'moonrey',
      packageHash: pkg.packageHash,
      approvals: fixtureHumanApprovals(pkg),
      activation: pkg.activation,
      expiresAtHeight: 80,
      evidenceHash: pkg.evidence.qualificationReportHash,
    });
    const expired = expireRestrictionWithoutResume(action, 80);
    assert.equal(expired.result, 'EXPIRED_AWAITING_AUTHORITY');
  });

  it('18. AI may recommend only', () => {
    const rec = recommendEmergencyAction({
      recommendationId: 'ai1',
      summary: 'restrict issuance',
      recommendedClasses: ['RESTRICT_NEW_MOONREY_ISSUANCE'],
    });
    assert.equal(rec.mayActivateEmergencyAuthority, false);
    assert.equal(rec.mayResumeCapability, false);
    assert.equal(rec.mayMint, false);
    assert.equal(rehearseAiBoundary().recommendation.maySignGovernanceAction, false);
  });

  it('19. AI cannot approve emergency action', () => {
    const result = rehearseAiBoundary();
    assert.equal(result.aiApprovalRefused, true);
    assert.equal(result.emergencyRefused, true);
    assert.equal(result.aiMayAuthorize, false);
    assert.equal(AI_CAN_AUTHORIZE_EMERGENCY, false);
  });

  it('20. emergency authority cannot mint', () => {
    const forbidden = rehearseForbiddenEmergencyPowers();
    assert.equal(forbidden.mint.accepted, false);
    assert.equal(forbidden.mint.rejectionReason, 'EMERGENCY_CANNOT_MINT');
    assert.equal(EMERGENCY_CAN_MINT, false);
  });

  it('21. emergency authority cannot confiscate', () => {
    const forbidden = rehearseForbiddenEmergencyPowers();
    assert.equal(forbidden.confiscate.accepted, false);
    assert.equal(forbidden.confiscate.rejectionReason, 'EMERGENCY_CANNOT_CONFISCATE');
    assert.equal(EMERGENCY_CAN_CONFISCATE, false);
  });

  it('22. emergency authority cannot rewrite finalized blocks', () => {
    const forbidden = rehearseForbiddenEmergencyPowers();
    assert.equal(forbidden.rewrite.accepted, false);
    assert.equal(forbidden.rewrite.rejectionReason, 'EMERGENCY_CANNOT_REWRITE_FINALIZED_HISTORY');
    assert.equal(forbidden.supply.rejectionReason, 'EMERGENCY_SUPPLY_REWRITE');
    assert.equal(EMERGENCY_CAN_REWRITE_FINALIZED_HISTORY, false);
    assert.equal(EMERGENCY_CAN_REWRITE_SUPPLY, false);
  });

  it('23. no LIVE flags changed', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
  });

  it('24. production remains inactive', () => {
    const rehearsal = runLaunchAbortRecoveryRehearsal();
    assert.equal(rehearsal.flags.PRODUCTION_ACTIVE, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(GLOBAL_SUPER_ADMIN_EXISTS, false);
    assert.equal(RESTRICTIONS_DOMAIN_SCOPED, true);
    assert.equal(INCIDENT_END_AUTO_RESUMES, false);
    assert.equal(existsSync(join(ROOT, 'packages/kill-switch')), false);
    assert.equal(existsSync(join(ROOT, 'packages/emergency-admin')), false);
    assert.equal(existsSync(join(ROOT, 'packages/rollback-engine')), false);
    assert.equal(existsSync(join(ROOT, 'packages/incident-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/recovery-v2')), false);
  });

  it('25. staged activation composes with abort and recovery', () => {
    const composed = composeStagedActivationAbortRecovery();
    assert.equal(composed.staged, true);
    assert.equal(composed.moonreyPaused, true);
    assert.equal(composed.oracleProviderSuspended, true);
    assert.equal(composed.moonreyIssuanceRestricted, true);
    assert.equal(composed.sunreyIssuanceIndependent, true);
    assert.equal(composed.exchangeStillAvailable, true);
    assert.equal(composed.paymentsStillAvailable, true);
    assert.equal(composed.reconciliationClean, true);
    assert.equal(composed.overwrite.bookOverwritten, false);
    assert.equal(composed.incidentEndAutoResumes, false);
    assert.equal(composed.humanApprovedResumption, true);
    assert.equal(composed.hsmSigningRestricted, true);
    assert.equal(composed.hsmMovedFunds, false);
    assert.equal(composed.pauseCannotMint, true);
    assert.equal(composed.pauseCannotRewriteHistory, true);
    assert.equal(composed.productionActive, false);
    const rehearsal = runLaunchAbortRecoveryRehearsal();
    assert.equal(rehearsal.stagedActivation.moonreyPaused, true);
    assert.equal(rehearsal.stagedActivation.hsmSigningRestricted, true);
  });
});
