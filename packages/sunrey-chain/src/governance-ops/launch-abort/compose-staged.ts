/**
 * Compose Chunk 166 staged activation with Chunk 167 abort/recovery.
 *
 * Rehearsal path: staged activation → oracle incident → domain pause →
 * provider suspension → MoonRey issuance restriction → unrelated
 * domains remain available → supply reconciliation → independently
 * authorized human resumption → HSM signing restriction.
 *
 * Pause and gates stay on the Chunk 166 owner. Emergency restriction
 * and resumption stay on the Chunk 79/167 owner. Neither path mints,
 * rewrites supply, or flips LIVE_* flags.
 */

import {
  applyEmergencyAction,
  buildOperationPackage,
  developmentEmergencyPolicy,
  developmentEvidence,
  fixtureHumanApprovals,
} from '../engine.ts';
import type { EmergencyActionClass, GovernanceOperationPackage } from '../types.ts';
import {
  applyPause,
  domainStatus,
  evaluateStagedActivation,
  healthyChainObservation,
  initialSequencerState,
  issuanceIndependencePreserved,
  overwriteSupplyBookRejected,
  pauseCandidate,
  pauseCannotCreateHumanApproval,
  pauseCannotMint,
  pauseCannotRewriteHistory,
  reconcileSupplyBooks,
  scopeFailure,
  withCustodyNotReady,
  withOracleDegraded,
} from '../../post-genesis/staged-activation/index.ts';
import { recoverHsmCompromise } from './recovery.ts';
import { availableUnrelatedCapabilities, restrictionPlanFor } from './restrictions.ts';
import { assembleResumptionCandidate } from './resumption.ts';

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
}) {
  return applyEmergencyAction({
    policy: developmentEmergencyPolicy(),
    actionId: input.actionId,
    incidentReference: input.incidentId,
    actionClass: input.actionClass,
    scope: input.scope,
    packageHash: input.pkg.packageHash,
    approvals: fixtureHumanApprovals(input.pkg),
    activation: input.pkg.activation,
    expiresAtHeight: 80,
    reviewAtHeight: 60,
    evidenceHash: input.pkg.evidence.qualificationReportHash,
  });
}

export function composeStagedActivationAbortRecovery() {
  const healthy = healthyChainObservation();
  const baseline = evaluateStagedActivation(healthy);
  const degraded = withOracleDegraded(healthy);
  const pause = pauseCandidate('MOONREY_COIN_ISSUANCE', 'oracle integrity incident during staged activation');
  const sequencer = applyPause(initialSequencerState(), 'MOONREY_COIN_ISSUANCE');
  const pausedReport = evaluateStagedActivation(degraded, sequencer);
  const moonrey = domainStatus(pausedReport, 'MOONREY_COIN_ISSUANCE');
  const sunrey = domainStatus(pausedReport, 'SUNREY_COIN_ISSUANCE');
  const exchange = domainStatus(pausedReport, 'SUNREY_EXCHANGE');
  const payments = domainStatus(pausedReport, 'PAYMENT_RAILS');
  const scoped = scopeFailure('ORACLE_DEGRADED', degraded);
  const plan = restrictionPlanFor({ incidentId: 'INC-ORACLE-COMPROMISE', domain: 'ORACLE' });
  const pkg = emergencyPackage('govops-compose-oracle-1');
  const suspend = restrict({
    actionId: 'emg_oracle_compose',
    incidentId: plan.incidentId,
    actionClass: 'SUSPEND_ORACLE_PROVIDER',
    scope: 'provider:oracle_rehearsal_1',
    pkg,
  });
  const issuance = restrict({
    actionId: 'emg_moonrey_compose',
    incidentId: plan.incidentId,
    actionClass: 'RESTRICT_NEW_MOONREY_ISSUANCE',
    scope: 'moonrey:new-issuance',
    pkg,
  });
  const available = availableUnrelatedCapabilities(plan.scopedCapabilities);
  const supply = reconcileSupplyBooks(degraded.supplyBooks);
  const overwrite = overwriteSupplyBookRejected();
  const resumeWithoutHuman = assembleResumptionCandidate({
    candidateId: 'resume_compose_auto',
    capability: 'MOONREY_COIN_NATIVE_ASSET',
    incidentId: plan.incidentId,
    restriction: issuance,
    rootCauseAddressed: true,
    reconciliationClean: supply.every((row) => row.conserved),
    providerEvidenceCurrent: true,
    securityReviewComplete: true,
    controlRoomHealthy: true,
    incidentResolved: true,
  });
  const humanResume = assembleResumptionCandidate({
    candidateId: 'resume_compose_human',
    capability: 'MOONREY_COIN_NATIVE_ASSET',
    incidentId: plan.incidentId,
    restriction: issuance,
    rootCauseAddressed: true,
    reconciliationClean: supply.every((row) => row.conserved),
    providerEvidenceCurrent: true,
    securityReviewComplete: true,
    controlRoomHealthy: true,
    incidentResolved: true,
    humanApproval: 'human.operations_authority',
  });
  const custodyObservation = withCustodyNotReady(degraded);
  const hsmPause = pauseCandidate('INSTITUTIONAL_CUSTODY', 'HSM signing route restricted');
  const hsmSequencer = applyPause(sequencer, 'INSTITUTIONAL_CUSTODY');
  const hsmReport = evaluateStagedActivation(custodyObservation, hsmSequencer);
  const custody = domainStatus(hsmReport, 'INSTITUTIONAL_CUSTODY');
  const hsm = recoverHsmCompromise();
  const hsmRestriction = restrict({
    actionId: 'emg_hsm_compose',
    incidentId: 'INC-HSM-COMPROMISE',
    actionClass: 'RESTRICT_CUSTODY_WITHDRAWALS',
    scope: 'route:custody-signing',
    pkg: emergencyPackage('govops-compose-hsm-1'),
  });

  return Object.freeze({
    staged: true,
    baseline,
    pause,
    pausedReport,
    moonrey,
    sunrey,
    exchange,
    payments,
    scoped,
    plan,
    suspend,
    issuance,
    available,
    supply,
    overwrite,
    resumeWithoutHuman,
    humanResume,
    hsmPause,
    custody,
    hsm,
    hsmRestriction,
    productionActive: baseline.productionActive,
    moonreyPaused: moonrey?.paused === true,
    moonreyIssuanceRestricted: issuance.accepted,
    oracleProviderSuspended: suspend.accepted,
    sunreyIssuanceIndependent: issuanceIndependencePreserved(degraded),
    exchangeStillAvailable: available.includes('SUNREY_EXCHANGE') && exchange?.paused !== true,
    paymentsStillAvailable: available.includes('PAYMENT_RAILS') && payments?.paused !== true,
    reconciliationClean: supply.every((row) => row.conserved && row.bookOverwritten === false),
    incidentEndAutoResumes: resumeWithoutHuman.runtimeEnabled,
    humanApprovedResumption: humanResume.runtimeEnabled,
    hsmSigningRestricted: hsm.signingDisabled && hsmRestriction.accepted && custody?.paused === true,
    hsmMovedFunds: hsm.assetsTransferredAutomatically,
    pauseCannotMint: pauseCannotMint(pause),
    pauseCannotRewriteHistory: pauseCannotRewriteHistory(pause),
    pauseCannotCreateHumanApproval: pauseCannotCreateHumanApproval(pause),
  });
}
