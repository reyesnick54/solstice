/**
 * Post-genesis health checkpoints.
 *
 * Conflicting-finality evidence is a critical protocol incident. It is
 * never classified as availability noise.
 */

import type {
  DatabaseHealthSample,
  FeeMarketSample,
  HealthComponentState,
  OracleHealthSample,
  PostGenesisCheckpoint,
  PostGenesisHealthReport,
  StorageGrowthSample,
  ValidatorStabilitySample,
} from './types.ts';

export type HealthObservation = {
  readonly validatorParticipationBps: number;
  readonly finality: HealthComponentState;
  readonly conflictingFinality: boolean;
  readonly stateRootAgreement: boolean;
  readonly peerHealth: HealthComponentState;
  readonly signerHealth: HealthComponentState;
  readonly storage: StorageGrowthSample;
  readonly database: DatabaseHealthSample;
  readonly rpc: HealthComponentState;
  readonly explorer: HealthComponentState;
  readonly backup: HealthComponentState;
  readonly oracle: OracleHealthSample;
  readonly economicConserved: boolean;
  readonly openIncidentCount: number;
  readonly validators: readonly ValidatorStabilitySample[];
  readonly feeMarket: FeeMarketSample;
};

export function healthyObservation(): HealthObservation {
  return Object.freeze({
    validatorParticipationBps: 10_000,
    finality: 'HEALTHY',
    conflictingFinality: false,
    stateRootAgreement: true,
    peerHealth: 'HEALTHY',
    signerHealth: 'HEALTHY',
    storage: healthyStorage(),
    database: healthyDatabase(),
    rpc: 'HEALTHY',
    explorer: 'HEALTHY',
    backup: 'HEALTHY',
    oracle: disabledOracle(),
    economicConserved: true,
    openIncidentCount: 0,
    validators: Object.freeze([
      healthyValidator('val_rehearsal_1'),
      healthyValidator('val_rehearsal_2'),
      healthyValidator('val_rehearsal_3'),
    ]),
    feeMarket: healthyFeeMarket(),
  });
}

export function healthyStorage(): StorageGrowthSample {
  return Object.freeze({
    redbBytes: 4_194_304n,
    walBytes: 262_144n,
    stateBytes: 1_048_576n,
    snapshotBytes: 2_097_152n,
    diskHeadroomBytes: 50_000_000_000n,
  });
}

export function healthyDatabase(): DatabaseHealthSample {
  return Object.freeze({
    primary: 'HEALTHY',
    replica: 'HEALTHY',
    replicationLagMs: 12,
    backup: 'HEALTHY',
    connectionSaturationBps: 1_200,
    transactionFailures: 0,
  });
}

export function disabledOracle(): OracleHealthSample {
  return Object.freeze({
    state: 'DISABLED',
    acceptedProvider: false,
    technicalHealthy: false,
    commercialEvidence: 'NOT_PROVIDED',
    governancePolicy: 'NOT_PROVIDED',
    humanApproval: 'NOT_PROVIDED',
  });
}

export function healthyFeeMarket(): FeeMarketSample {
  return Object.freeze({
    baseResourcePriceMinor: 100n,
    blockUtilizationBps: 1_500,
    resourceSaturationBps: 1_200,
    feeDistributedMinor: 25n,
    unexpectedOscillation: false,
  });
}

export function healthyValidator(validatorId: string): ValidatorStabilitySample {
  return Object.freeze({
    validatorId,
    missedVotes: 0,
    proposedBlocks: 1,
    peerConnected: true,
    restarts: 0,
    catchingUp: false,
    signerWarning: false,
    jailed: false,
    bonded: true,
  });
}

export function composeHealthReport(
  checkpoint: PostGenesisCheckpoint,
  observation: HealthObservation,
): PostGenesisHealthReport {
  const engineeringHealthy =
    !observation.conflictingFinality &&
    observation.stateRootAgreement &&
    observation.finality === 'HEALTHY' &&
    observation.economicConserved &&
    observation.signerHealth !== 'UNHEALTHY' &&
    observation.storage.diskHeadroomBytes > 0n &&
    observation.database.primary !== 'UNHEALTHY';
  return Object.freeze({
    checkpoint,
    ...observation,
    engineeringHealthy,
  });
}

export function storagePressure(observation: HealthObservation, headroomBytes: bigint): HealthObservation {
  return Object.freeze({
    ...observation,
    storage: Object.freeze({ ...observation.storage, diskHeadroomBytes: headroomBytes }),
  });
}

export function databaseIssue(observation: HealthObservation): HealthObservation {
  return Object.freeze({
    ...observation,
    database: Object.freeze({
      ...observation.database,
      replica: 'UNHEALTHY',
      replicationLagMs: 12_000,
      transactionFailures: 4,
    }),
  });
}

export function feeSpike(observation: HealthObservation): HealthObservation {
  return Object.freeze({
    ...observation,
    feeMarket: Object.freeze({
      baseResourcePriceMinor: 10_000n,
      blockUtilizationBps: 9_800,
      resourceSaturationBps: 9_500,
      feeDistributedMinor: 800n,
      unexpectedOscillation: true,
    }),
  });
}

export function oracleDegraded(observation: HealthObservation): HealthObservation {
  return Object.freeze({
    ...observation,
    oracle: Object.freeze({
      state: 'DEGRADED',
      acceptedProvider: true,
      technicalHealthy: false,
      commercialEvidence: 'PROVIDED_UNVERIFIED',
      governancePolicy: 'NOT_PROVIDED',
      humanApproval: 'NOT_PROVIDED',
    }),
  });
}

export function validatorLoss(observation: HealthObservation, validatorId: string): HealthObservation {
  const validators = observation.validators.map((row) =>
    row.validatorId === validatorId
      ? Object.freeze({
          ...row,
          missedVotes: 12,
          peerConnected: false,
          catchingUp: true,
          jailed: true,
          bonded: false,
        })
      : row,
  );
  return Object.freeze({
    ...observation,
    validatorParticipationBps: 6_666,
    validators: Object.freeze(validators),
    peerHealth: 'DEGRADED',
  });
}

export function conflictingFinality(observation: HealthObservation): HealthObservation {
  return Object.freeze({
    ...observation,
    conflictingFinality: true,
    finality: 'UNHEALTHY',
    stateRootAgreement: false,
  });
}
