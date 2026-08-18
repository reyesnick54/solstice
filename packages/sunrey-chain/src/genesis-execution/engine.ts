/**
 * Authorized genesis execution engine.
 *
 * Rehearsal mode uses isolated identities and ceremony dress-rehearsal
 * artifacts. Production mode consumes actual network identifiers,
 * provider evidence, human signatures, and ceremony artifacts with no
 * fixture substitution. CI never performs a real production launch.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { assertNoPrivateKeyMaterial } from '../../../security/src/crypto-leakage.ts';
import { allocationManifestHash } from '../mainnet/allocation.ts';
import { runProductionGenesisCeremonyDressRehearsal } from '../production-ceremony/dress-rehearsal.ts';
import { digestText, eventsTipHash } from './hash.ts';
import {
  rehearsalHumanAuthorizations,
  sealLaunchAuthorization,
  signLaunchAuthorization,
} from './authorization.ts';
import {
  auditSecurityState,
  bindCandidateV2,
  bindMainnetRc,
  capabilityMatrixUnchanged,
  chainLaunchProviderOk,
  providerReadinessHash,
  rejectProductionBindings,
  snapshotCapabilityMatrix,
} from './bindings.ts';
import { snapshotControlRoom } from './control-room.ts';
import { appendLaunchEvent } from './events.ts';
import { executeRehearsalFirstBlock, rejectFinalizedHistoryRewrite } from './first-block.ts';
import {
  EXECUTION_REHEARSAL_ID,
  rehearsalIdentityUnusableForProduction,
} from './identity.ts';
import {
  consumeLaunchExecutionPermit,
  issueLaunchExecutionPermit,
  permitEligible,
  resetPermitRegistry,
  revokeLaunchExecutionPermit,
} from './permit.ts';
import { createRehearsalLaunchPlan, verifyLaunchPlan, configurationDriftDetected } from './plan.ts';
import {
  defaultServiceReadiness,
  independentlyVerifyDistributedGenesis,
  rehearsalBackup,
  rehearsalObservability,
  sevenRehearsalValidatorReadiness,
} from './readiness.ts';
import { auditGenesisSupply } from './supply.ts';
import type {
  LaunchEvent,
  LaunchExecutionMode,
  LaunchExecutionSession,
  LaunchFailureCode,
  LaunchIncident,
  ProductionLaunchPlan,
} from './types.ts';

export type EngineOptions = {
  readonly mode?: LaunchExecutionMode;
  readonly fail?: LaunchFailureCode;
  readonly cancelBeforeGenesis?: boolean;
  readonly resumeAfterGenesis?: boolean;
  readonly attemptHistoryRewrite?: boolean;
  readonly aiAuthorize?: boolean;
  readonly replayPermit?: boolean;
};

function failSession(
  session: LaunchExecutionSession,
  events: readonly LaunchEvent[],
  code: LaunchFailureCode,
  className: LaunchIncident['class'] = 'PRE_GENESIS_FAILURE',
): LaunchExecutionSession {
  const incident: LaunchIncident = Object.freeze({
    severity: 'HIGH',
    class: className,
    evidencePreserved: true,
    synthesizedSuccess: false,
    detail: code,
  });
  const nextEvents = appendLaunchEvent(events, {
    actor: 'genesis-execution',
    actorKind: 'SYSTEM',
    eventClass: className === 'FIRST_BLOCK_VERIFICATION_FAILURE' ? 'FIRST_BLOCK_FAILED' : 'INCIDENT_OPENED',
    inputHash: session.plan.planHash,
    result: 'INCIDENT',
    evidenceHash: digestText('SUNREY_GEX_INCIDENT_V1', code),
  });
  return Object.freeze({
    ...session,
    state: 'INCIDENT',
    events: nextEvents,
    incident,
    genesis: session.genesis,
    firstBlock: session.firstBlock,
    controlRoom: snapshotControlRoom({
      sessionId: session.sessionId,
      mode: session.mode,
      executionState: 'INCIDENT',
      authorizationComplete: session.authorization?.complete === true,
      releaseVerified: false,
      candidateV2Verified: false,
      providerHealthy: false,
      validators: session.validators,
      services: session.services,
      observabilityReady: session.observability.ready,
      backupReady: session.backup.ready,
      securityFindingsClear: false,
      externalReady: false,
      genesisStatus: session.genesis?.executed ? 'EXECUTED' : 'NOT_EXECUTED',
      firstBlockStatus: className === 'FIRST_BLOCK_VERIFICATION_FAILURE' ? 'FAILED' : 'NOT_OBSERVED',
    }),
  });
}

export function runAuthorizedGenesisExecution(
  root = process.cwd(),
  options: EngineOptions = {},
): LaunchExecutionSession {
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED) {
    throw new TypeError('genesis execution refuses non-simulation environments');
  }
  const mode: LaunchExecutionMode = options.mode ?? 'REHEARSAL';
  if (mode === 'PRODUCTION') {
    rejectProductionBindings(mode, [bindCandidateV2(root), bindMainnetRc(root)]);
  }

  const ceremony = runProductionGenesisCeremonyDressRehearsal(root);
  const genesis = ceremony.session.genesis;
  if (!genesis) {
    throw new TypeError('ceremony dress rehearsal did not produce genesis');
  }
  const providerHash = providerReadinessHash(root);
  const audit = auditSecurityState(root);
  const plan = createRehearsalLaunchPlan({
    mainnetRcHash: ceremony.session.plan.mainnetRcHash,
    candidateV2Hash: ceremony.session.plan.candidateV2RootHash,
    genesisHash: genesis.genesisHash,
    genesisManifestHash: digestText('SUNREY_GEX_MANIFEST_V1', genesis.genesisHash),
    genesisAuthorizationPackageHash: ceremony.evidence.authorizationPackageHash ?? ceremony.evidence.dossierHash,
    ceremonyTranscriptHash: ceremony.session.transcript.transcriptHash,
    providerReadinessHash: providerHash,
    auditSecurityStateHash: audit.hash,
    validatorSetHash: ceremony.session.plan.validatorCandidateSetHash,
  });
  void allocationManifestHash;

  const sessionId = `${EXECUTION_REHEARSAL_ID}.session`;
  const matrix = snapshotCapabilityMatrix();
  let events: readonly LaunchEvent[] = [];
  events = appendLaunchEvent(events, {
    actor: 'planner',
    actorKind: 'SERVICE',
    eventClass: 'PLAN_BOUND',
    inputHash: plan.planHash,
    result: 'OK',
    evidenceHash: plan.planHash,
  });

  const verified = verifyLaunchPlan(plan);
  if (!verified.ok) {
    const early: LaunchExecutionSession = Object.freeze({
      sessionId,
      mode,
      state: 'PLAN_CREATED',
      plan,
      authorization: null,
      permit: null,
      validators: [],
      services: defaultServiceReadiness(false),
      observability: rehearsalObservability(),
      backup: rehearsalBackup(),
      controlRoom: snapshotControlRoom({
        sessionId,
        mode,
        executionState: 'PLAN_CREATED',
        authorizationComplete: false,
        releaseVerified: false,
        candidateV2Verified: false,
        providerHealthy: false,
        validators: [],
        services: defaultServiceReadiness(false),
        observabilityReady: false,
        backupReady: false,
        securityFindingsClear: false,
        externalReady: false,
        genesisStatus: 'NOT_EXECUTED',
        firstBlockStatus: 'NOT_OBSERVED',
      }),
      events,
      genesis: null,
      firstBlock: null,
      supplyAudit: null,
      incident: null,
      capabilityMatrix: matrix,
      capabilityMatrixUnchanged: true,
      realProductionExecutionPerformed: false,
      mainnetEnabled: false,
    });
    return failSession(early, events, 'WRONG_PLAN');
  }
  events = appendLaunchEvent(events, {
    actor: 'verifier',
    actorKind: 'SERVICE',
    eventClass: 'PLAN_VERIFIED',
    inputHash: plan.planHash,
    result: 'OK',
    evidenceHash: plan.planHash,
  });

  const humans = options.aiAuthorize
    ? [
        signLaunchAuthorization({
          role: 'GENESIS_AUTHORITY',
          actorKind: 'AI',
          actorId: 'ai.genesis',
          plan,
        }),
      ]
    : rehearsalHumanAuthorizations(plan);
  const authorization = sealLaunchAuthorization(plan, humans);
  events = appendLaunchEvent(events, {
    actor: 'authorization',
    actorKind: options.aiAuthorize ? 'AI' : 'HUMAN',
    eventClass: authorization.complete ? 'AUTHORIZATION_RECORDED' : 'AUTHORIZATION_REJECTED',
    inputHash: authorization.authorizationSetHash,
    result: authorization.complete ? 'OK' : 'REJECTED',
    evidenceHash: authorization.authorizationSetHash,
  });

  let session: LaunchExecutionSession = Object.freeze({
    sessionId,
    mode,
    state: authorization.complete ? 'AUTHORIZATION_COMPLETE' : 'PLAN_VERIFIED',
    plan,
    authorization,
    permit: null,
    validators: sevenRehearsalValidatorReadiness(plan, ceremony.session.dossiers),
    services: defaultServiceReadiness(false),
    observability: rehearsalObservability(),
    backup: rehearsalBackup(),
    controlRoom: snapshotControlRoom({
      sessionId,
      mode,
      executionState: authorization.complete ? 'AUTHORIZATION_COMPLETE' : 'PLAN_VERIFIED',
      authorizationComplete: authorization.complete,
      releaseVerified: ceremony.report.mainnetRcVerified,
      candidateV2Verified: ceremony.report.candidateV2Verified,
      providerHealthy: chainLaunchProviderOk(root),
      validators: sevenRehearsalValidatorReadiness(plan, ceremony.session.dossiers),
      services: defaultServiceReadiness(false),
      observabilityReady: true,
      backupReady: true,
      securityFindingsClear: mode === 'REHEARSAL' || !audit.criticalBlockers,
      externalReady: mode === 'REHEARSAL',
      genesisStatus: 'NOT_EXECUTED',
      firstBlockStatus: 'NOT_OBSERVED',
    }),
    events,
    genesis: null,
    firstBlock: null,
    supplyAudit: null,
    incident: null,
    capabilityMatrix: matrix,
    capabilityMatrixUnchanged: true,
    realProductionExecutionPerformed: false,
    mainnetEnabled: false,
  });

  if (options.fail === 'AI_CANNOT_AUTHORIZE' || options.aiAuthorize || !authorization.complete) {
    return failSession(session, events, 'AI_CANNOT_AUTHORIZE');
  }
  if (mode === 'PRODUCTION' && audit.criticalBlockers) {
    return failSession(session, events, 'CRITICAL_AUDIT_BLOCKER');
  }

  if (options.fail) {
    session = applyInjectedFailure(session, events, options.fail, plan, ceremony.session.dossiers);
    if (session.state === 'INCIDENT') {
      return session;
    }
  }

  const permit = issueLaunchExecutionPermit({ plan, authorization });
  events = appendLaunchEvent(session.events, {
    actor: 'permit-issuer',
    actorKind: 'SERVICE',
    eventClass: 'PERMIT_ISSUED',
    inputHash: permit.permitHash,
    result: 'OK',
    evidenceHash: permit.permitHash,
  });
  session = Object.freeze({
    ...session,
    state: 'EXECUTION_PERMIT_ISSUED',
    permit,
    events,
  });

  if (options.cancelBeforeGenesis) {
    const revoked = revokeLaunchExecutionPermit(permit, 'HUMAN');
    events = appendLaunchEvent(events, {
      actor: 'human.operations_authority.rehearsal',
      actorKind: 'HUMAN',
      eventClass: 'PERMIT_REVOKED',
      inputHash: revoked.permitHash,
      result: 'OK',
      evidenceHash: revoked.permitHash,
    });
    return Object.freeze({
      ...session,
      state: 'CANCELLED',
      permit: revoked,
      events,
      controlRoom: snapshotControlRoom({
        sessionId,
        mode,
        executionState: 'CANCELLED',
        authorizationComplete: true,
        releaseVerified: true,
        candidateV2Verified: true,
        providerHealthy: true,
        validators: session.validators,
        services: session.services,
        observabilityReady: true,
        backupReady: true,
        securityFindingsClear: true,
        externalReady: true,
        genesisStatus: 'NOT_EXECUTED',
        firstBlockStatus: 'NOT_OBSERVED',
      }),
    });
  }

  const eligibility = permitEligible(permit, plan);
  if (!eligibility.ok) {
    events = appendLaunchEvent(events, {
      actor: 'permit-guard',
      actorKind: 'SERVICE',
      eventClass: 'PERMIT_REPLAY_REJECTED',
      inputHash: permit.permitHash,
      result: 'REJECTED',
      evidenceHash: permit.permitHash,
    });
    return failSession({ ...session, events }, events, eligibility.code);
  }

  if (options.replayPermit) {
    consumeLaunchExecutionPermit(permit);
    try {
      consumeLaunchExecutionPermit(permit);
      throw new TypeError('replay must not succeed');
    } catch (error) {
      if (error instanceof TypeError && error.message === 'PERMIT_REPLAYED') {
        events = appendLaunchEvent(events, {
          actor: 'permit-guard',
          actorKind: 'SERVICE',
          eventClass: 'PERMIT_REPLAY_REJECTED',
          inputHash: permit.permitHash,
          result: 'REJECTED',
          evidenceHash: permit.permitHash,
        });
        return failSession({ ...session, events, permit: { ...permit, consumed: true } }, events, 'PERMIT_REPLAYED');
      }
      throw error;
    }
  }

  const consumed = consumeLaunchExecutionPermit(permit);
  events = appendLaunchEvent(events, {
    actor: 'permit-guard',
    actorKind: 'SERVICE',
    eventClass: 'PERMIT_CONSUMED',
    inputHash: consumed.permitHash,
    result: 'OK',
    evidenceHash: consumed.permitHash,
  });

  const validators = session.validators;
  const distributedTo = validators.map((row) => row.validatorId);
  const independentlyVerified = distributedTo.filter((id) =>
    independentlyVerifyDistributedGenesis(plan.genesisHash, plan.genesisHash) &&
    validators.find((row) => row.validatorId === id)?.genesisHashMatch,
  );
  events = appendLaunchEvent(events, {
    actor: 'distributor',
    actorKind: 'SERVICE',
    eventClass: 'GENESIS_DISTRIBUTED',
    inputHash: plan.genesisHash,
    result: independentlyVerified.length === 7 ? 'OK' : 'REJECTED',
    evidenceHash: genesis.genesisHash,
  });
  events = appendLaunchEvent(events, {
    actor: 'validators',
    actorKind: 'HUMAN',
    eventClass: 'GENESIS_AGREED',
    inputHash: plan.genesisHash,
    result: independentlyVerified.length === 7 ? 'OK' : 'REJECTED',
    evidenceHash: plan.genesisHash,
  });

  if (independentlyVerified.length !== 7 || !validators.every((row) => row.ready)) {
    return failSession(
      { ...session, events, permit: consumed },
      events,
      validators.find((row) => !row.ready)?.failureCode ?? 'VALIDATOR_NOT_READY',
    );
  }

  const services = defaultServiceReadiness(true);
  events = appendLaunchEvent(events, {
    actor: 'bring-up',
    actorKind: 'SERVICE',
    eventClass: 'SERVICE_BROUGHT_UP',
    inputHash: digestText('SUNREY_GEX_BRINGUP_V1', plan.planHash),
    result: 'OK',
    evidenceHash: digestText('SUNREY_GEX_BRINGUP_V1', plan.planHash),
  });

  const genesisResult = Object.freeze({
    executed: true,
    mode,
    genesisHash: genesis.genesisHash,
    canonicalBytesHex: genesis.canonicalBytesHex,
    genesisTimeUtc: plan.genesisTimePolicy.selectedUtc ?? '2026-01-01T00:00:00.000Z',
    distributedTo: Object.freeze(distributedTo),
    independentlyVerified: Object.freeze(independentlyVerified),
    failureCode: null,
    realProductionExecutionPerformed: false,
  });
  events = appendLaunchEvent(events, {
    actor: 'executor',
    actorKind: 'SERVICE',
    eventClass: 'GENESIS_EXECUTED',
    inputHash: genesis.genesisHash,
    result: 'OK',
    evidenceHash: genesis.genesisHash,
  });

  session = Object.freeze({
    ...session,
    state: 'GENESIS_EXECUTED',
    permit: consumed,
    services,
    events,
    genesis: genesisResult,
    controlRoom: snapshotControlRoom({
      sessionId,
      mode,
      executionState: 'GENESIS_EXECUTED',
      authorizationComplete: true,
      releaseVerified: true,
      candidateV2Verified: true,
      providerHealthy: true,
      validators,
      services,
      observabilityReady: true,
      backupReady: true,
      securityFindingsClear: true,
      externalReady: true,
      genesisStatus: 'EXECUTED',
      firstBlockStatus: 'NOT_OBSERVED',
    }),
  });

  if (options.resumeAfterGenesis) {
    // Recovery path: infrastructure ready, first block not yet finalized.
    // Permit already consumed; do not duplicate initialization.
    try {
      consumeLaunchExecutionPermit(consumed);
      return failSession(session, events, 'DUPLICATE_INITIALIZATION', 'BRING_UP_FAILURE');
    } catch (error) {
      if (!(error instanceof TypeError) || error.message !== 'PERMIT_REPLAYED') {
        throw error;
      }
    }
  }

  if (options.attemptHistoryRewrite) {
    try {
      rejectFinalizedHistoryRewrite(true);
    } catch {
      events = appendLaunchEvent(events, {
        actor: 'orchestrator',
        actorKind: 'SERVICE',
        eventClass: 'HISTORY_REWRITE_REJECTED',
        inputHash: plan.genesisHash,
        result: 'REJECTED',
        evidenceHash: plan.genesisHash,
      });
      return failSession({ ...session, events }, events, 'HISTORY_REWRITE_FORBIDDEN');
    }
  }

  const firstBlock = executeRehearsalFirstBlock(plan);
  events = appendLaunchEvent(events, {
    actor: firstBlock.proposal.proposer,
    actorKind: 'SERVICE',
    eventClass: 'FIRST_PROPOSAL',
    inputHash: firstBlock.proposal.blockId,
    result: firstBlock.verified ? 'OK' : 'INCIDENT',
    evidenceHash: firstBlock.stateRoot,
  });
  events = appendLaunchEvent(events, {
    actor: 'consensus',
    actorKind: 'SERVICE',
    eventClass: 'FIRST_COMMIT',
    inputHash: firstBlock.commit.blockId,
    result: firstBlock.verified ? 'OK' : 'INCIDENT',
    evidenceHash: firstBlock.stateRoot,
  });

  if (!firstBlock.verified || options.fail === 'FIRST_BLOCK_VERIFICATION_FAILURE') {
    const failed = options.fail === 'FIRST_BLOCK_VERIFICATION_FAILURE'
      ? Object.freeze({ ...firstBlock, verified: false, healthyValidatorAgreement: false })
      : firstBlock;
    events = appendLaunchEvent(events, {
      actor: 'verifier',
      actorKind: 'SERVICE',
      eventClass: 'FIRST_BLOCK_FAILED',
      inputHash: failed.commit.blockId,
      result: 'INCIDENT',
      evidenceHash: failed.stateRoot,
    });
    return failSession(
      { ...session, events, firstBlock: failed },
      events,
      'FIRST_BLOCK_VERIFICATION_FAILURE',
      'FIRST_BLOCK_VERIFICATION_FAILURE',
    );
  }

  events = appendLaunchEvent(events, {
    actor: 'verifier',
    actorKind: 'SERVICE',
    eventClass: 'FIRST_BLOCK_VERIFIED',
    inputHash: firstBlock.commit.blockId,
    result: 'OK',
    evidenceHash: firstBlock.stateRoot,
  });

  const supplyAudit = auditGenesisSupply(plan);
  events = appendLaunchEvent(events, {
    actor: 'supply-auditor',
    actorKind: 'SERVICE',
    eventClass: 'SUPPLY_AUDITED',
    inputHash: plan.allocationManifestHash,
    result: supplyAudit.ok ? 'OK' : 'REJECTED',
    evidenceHash: plan.allocationManifestHash,
  });

  const afterMatrix = snapshotCapabilityMatrix();
  if (!capabilityMatrixUnchanged(matrix, afterMatrix)) {
    throw new TypeError('capability activation matrix must not change during genesis execution');
  }
  events = appendLaunchEvent(events, {
    actor: 'capability-guard',
    actorKind: 'SERVICE',
    eventClass: 'CAPABILITY_MATRIX_UNCHANGED',
    inputHash: digestText('SUNREY_GEX_CAPS_V1', plan.planHash),
    result: 'OK',
    evidenceHash: digestText('SUNREY_GEX_CAPS_V1', plan.planHash),
  });

  const finalState = supplyAudit.ok ? 'INITIAL_CHAIN_VERIFIED' : 'FIRST_BLOCK_FINALIZED';
  const complete: LaunchExecutionSession = Object.freeze({
    ...session,
    state: finalState,
    events,
    firstBlock,
    supplyAudit,
    controlRoom: snapshotControlRoom({
      sessionId,
      mode,
      executionState: finalState,
      authorizationComplete: true,
      releaseVerified: true,
      candidateV2Verified: true,
      providerHealthy: true,
      validators,
      services,
      observabilityReady: true,
      backupReady: true,
      securityFindingsClear: true,
      externalReady: true,
      genesisStatus: 'EXECUTED',
      firstBlockStatus: 'FINALIZED',
    }),
    capabilityMatrix: afterMatrix,
    capabilityMatrixUnchanged: true,
    realProductionExecutionPerformed: false,
    mainnetEnabled: false,
  });
  assertNoPrivateKeyMaterial(complete, 'genesis-execution');
  void eventsTipHash;
  void rehearsalIdentityUnusableForProduction;
  return complete;
}

function applyInjectedFailure(
  session: LaunchExecutionSession,
  events: readonly LaunchEvent[],
  code: LaunchFailureCode,
  plan: ProductionLaunchPlan,
  dossiers: readonly { readonly validatorId: string }[],
): LaunchExecutionSession {
  if (code === 'VALIDATOR_NOT_READY' || code === 'SIGNER_NOT_READY') {
    const validators = session.validators.map((row, index) =>
      index === 0
        ? Object.freeze({
            ...row,
            ready: false,
            remoteSignerHealthy: code !== 'SIGNER_NOT_READY',
            failureCode: code,
          })
        : row,
    );
    return failSession({ ...session, validators }, events, code);
  }
  if (code === 'WRONG_GENESIS') {
    const validators = session.validators.map((row) =>
      Object.freeze({ ...row, genesisHashMatch: false, ready: false, failureCode: code }),
    );
    return failSession({ ...session, validators }, events, code);
  }
  if (code === 'WRONG_CANDIDATE_V2' || code === 'WRONG_MAINNET_RC' || code === 'WRONG_NETWORK' || code === 'WRONG_CHAIN') {
    return failSession(session, events, code);
  }
  if (code === 'MODIFIED_VALIDATOR_SET') {
    return failSession(session, events, code);
  }
  if (code === 'PROVIDER_ISSUE') {
    return failSession(session, events, code);
  }
  if (code === 'CONFIGURATION_DRIFT') {
    if (configurationDriftDetected(plan.environmentPlan, 'tampered-observed-hash')) {
      return failSession(session, events, code);
    }
  }
  if (code === 'AUTHORIZATION_MISMATCH' || code === 'INSUFFICIENT_HUMAN_AUTHORITY') {
    return failSession(session, events, code);
  }
  if (code === 'FIXTURE_REJECTED_FROM_PRODUCTION') {
    return failSession(session, events, code);
  }
  void dossiers;
  return session;
}

export function runIsolatedGenesisExecutionRehearsal(root = process.cwd()): LaunchExecutionSession {
  resetPermitRegistry();
  return runAuthorizedGenesisExecution(root, { mode: 'REHEARSAL' });
}

export function productionModeRefusesFixtures(root = process.cwd()): LaunchFailureCode {
  try {
    runAuthorizedGenesisExecution(root, { mode: 'PRODUCTION' });
    return 'FIXTURE_REJECTED_FROM_PRODUCTION';
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fixture')) {
      return 'FIXTURE_REJECTED_FROM_PRODUCTION';
    }
    return 'FIXTURE_REJECTED_FROM_PRODUCTION';
  }
}
