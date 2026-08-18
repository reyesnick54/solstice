/**
 * ProductionLaunchControlRoomState aggregates authorization, release, Candidate
 * V2, provider, validator, signer, network, storage, database,
 * observability, backup, security, external, genesis, and first-block
 * status. Chain genesis is not capability authorization.
 */

import type {
  ProductionLaunchControlRoomState,
  LaunchExecutionMode,
  LaunchExecutionState,
  LaunchServiceReadiness,
  LaunchValidatorReadiness,
} from './types.ts';
import { SERVICE_BRING_UP_SEQUENCE } from './types.ts';

export function emptyControlRoom(input: {
  readonly sessionId: string;
  readonly mode: LaunchExecutionMode;
}): ProductionLaunchControlRoomState {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: input.sessionId,
    mode: input.mode,
    executionState: 'PLAN_CREATED',
    authorizationComplete: false,
    releaseVerified: false,
    candidateV2Verified: false,
    providerHealthy: false,
    validatorsReady: false,
    signersReady: false,
    networkReady: false,
    storageReady: false,
    databaseReady: false,
    observabilityReady: false,
    backupReady: false,
    securityFindingsClear: false,
    externalReady: false,
    genesisStatus: 'NOT_EXECUTED',
    firstBlockStatus: 'NOT_OBSERVED',
    capabilityActivationUnchanged: true,
    productionActivated: false,
    liveFlagsRemainDisabled: true,
  });
}

export function snapshotControlRoom(input: {
  readonly sessionId: string;
  readonly mode: LaunchExecutionMode;
  readonly executionState: LaunchExecutionState;
  readonly authorizationComplete: boolean;
  readonly releaseVerified: boolean;
  readonly candidateV2Verified: boolean;
  readonly providerHealthy: boolean;
  readonly validators: readonly LaunchValidatorReadiness[];
  readonly services: readonly LaunchServiceReadiness[];
  readonly observabilityReady: boolean;
  readonly backupReady: boolean;
  readonly securityFindingsClear: boolean;
  readonly externalReady: boolean;
  readonly genesisStatus: ProductionLaunchControlRoomState['genesisStatus'];
  readonly firstBlockStatus: ProductionLaunchControlRoomState['firstBlockStatus'];
}): ProductionLaunchControlRoomState {
  const sequenced = input.services.filter((row) =>
    (SERVICE_BRING_UP_SEQUENCE as readonly string[]).includes(row.step),
  );
  return Object.freeze({
    schemaVersion: 1,
    sessionId: input.sessionId,
    mode: input.mode,
    executionState: input.executionState,
    authorizationComplete: input.authorizationComplete,
    releaseVerified: input.releaseVerified,
    candidateV2Verified: input.candidateV2Verified,
    providerHealthy: input.providerHealthy,
    validatorsReady: input.validators.length === 7 && input.validators.every((row) => row.ready),
    signersReady: input.validators.every((row) => row.remoteSignerHealthy && row.antiDoubleSignInitialized),
    networkReady: input.validators.every((row) => row.peerSentryConfigured && row.networkMatch),
    storageReady: input.validators.every((row) => row.storageHealthy),
    databaseReady: sequenced.find((row) => row.step === 'INFRASTRUCTURE')?.healthy === true,
    observabilityReady: input.observabilityReady,
    backupReady: input.backupReady,
    securityFindingsClear: input.securityFindingsClear,
    externalReady: input.externalReady,
    genesisStatus: input.genesisStatus,
    firstBlockStatus: input.firstBlockStatus,
    capabilityActivationUnchanged: true,
    productionActivated: false,
    liveFlagsRemainDisabled: true,
  });
}
