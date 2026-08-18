/**
 * Validator, service, signer, observability, and backup readiness.
 *
 * Each production validator independently verifies candidate, genesis
 * hash, consensus key, network, chain, artifact, remote signer,
 * anti-double-sign state, peer/sentry config, time sync, storage,
 * and operator acknowledgement of the exact genesis hash.
 */

import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { PURPOSE_TO_CANONICAL, signSimulationChallenge, verifySimulationChallenge } from '../production-ceremony/keys.ts';
import { dressRehearsalKeyLabel } from '../production-ceremony/validators.ts';
import type { ProductionValidatorDossier } from '../production-ceremony/types.ts';
import { digestText } from './hash.ts';
import type {
  LaunchBackupReadiness,
  LaunchFailureCode,
  LaunchObservabilityReadiness,
  LaunchServiceReadiness,
  LaunchValidatorReadiness,
  ProductionLaunchPlan,
} from './types.ts';
import { INDEPENDENTLY_GATED_SERVICES, SERVICE_BRING_UP_SEQUENCE } from './types.ts';

const SIGNER_CHALLENGE_DOMAIN = 'SUNREY_GENESIS_EXECUTION_SIGNER_CHALLENGE_V1';

export const SEVEN_LAUNCH_VALIDATOR_IDS = [
  'val_launch_a',
  'val_launch_b',
  'val_launch_c',
  'val_launch_d',
  'val_launch_e',
  'val_launch_f',
  'val_launch_g',
] as const;

export function safeSignerChallengeMessage(validatorId: string, chainId: string): Buffer {
  return Buffer.concat([
    encodeString(SIGNER_CHALLENGE_DOMAIN),
    encodeString(validatorId),
    encodeString(chainId),
    encodeString('NOT_A_CONSENSUS_BLOCK'),
    encodeString('NOT_A_FUTURE_HEIGHT'),
    encodeString('NOT_A_FUTURE_ROUND'),
  ]);
}

export function challengeLaunchSigner(input: {
  readonly validatorId: string;
  readonly chainId: string;
  readonly expectedPublicKey: string;
  readonly labelIndex: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
}): { readonly ok: boolean; readonly publicKeyHex: string } {
  const message = safeSignerChallengeMessage(input.validatorId, input.chainId);
  const signed = signSimulationChallenge(
    dressRehearsalKeyLabel(input.labelIndex, 'consensus'),
    PURPOSE_TO_CANONICAL.VALIDATOR_CONSENSUS,
    `gex-rehearsal-${input.labelIndex}-consensus`,
    message,
  );
  const verified = verifySimulationChallenge(signed.publicKeyHex, message, signed.signatureHex);
  return {
    ok: verified && signed.publicKeyHex === input.expectedPublicKey,
    publicKeyHex: signed.publicKeyHex,
  };
}

export function evaluateValidatorReadiness(input: {
  readonly plan: ProductionLaunchPlan;
  readonly dossier: ProductionValidatorDossier;
  readonly observedGenesisHash: string;
  readonly observedCandidateHash: string;
  readonly observedNetworkId: string;
  readonly observedChainId: string;
  readonly remoteSignerHealthy: boolean;
  readonly antiDoubleSignInitialized: boolean;
  readonly peerSentryConfigured: boolean;
  readonly timeSyncHealthy: boolean;
  readonly storageHealthy: boolean;
  readonly operatorAcknowledgedHash: string | null;
  readonly consensusPublicKey: string;
  readonly artifactHash: string;
}): LaunchValidatorReadiness {
  const candidateMatch = input.observedCandidateHash === input.plan.candidateV2Hash;
  const genesisHashMatch = input.observedGenesisHash === input.plan.genesisHash;
  const consensusPublicKeyMatch = input.consensusPublicKey === input.dossier.consensusPublicKeyDescriptor;
  const networkMatch = input.observedNetworkId === input.plan.networkId;
  const chainMatch = input.observedChainId === input.plan.chainId;
  const artifactMatch = input.artifactHash === input.plan.genesisHash;
  const operatorAcknowledged = input.operatorAcknowledgedHash === input.plan.genesisHash;
  let failureCode: LaunchFailureCode | null = null;
  if (!candidateMatch) failureCode = 'WRONG_CANDIDATE_V2';
  else if (!genesisHashMatch || !artifactMatch) failureCode = 'WRONG_GENESIS';
  else if (!networkMatch) failureCode = 'WRONG_NETWORK';
  else if (!chainMatch) failureCode = 'WRONG_CHAIN';
  else if (!consensusPublicKeyMatch) failureCode = 'SIGNER_NOT_READY';
  else if (!input.remoteSignerHealthy || !input.antiDoubleSignInitialized) failureCode = 'SIGNER_NOT_READY';
  else if (!input.peerSentryConfigured || !input.timeSyncHealthy || !input.storageHealthy || !operatorAcknowledged) {
    failureCode = 'VALIDATOR_NOT_READY';
  }
  return Object.freeze({
    validatorId: input.dossier.validatorId,
    candidateMatch,
    genesisHashMatch,
    consensusPublicKeyMatch,
    networkMatch,
    chainMatch,
    artifactMatch,
    remoteSignerHealthy: input.remoteSignerHealthy,
    antiDoubleSignInitialized: input.antiDoubleSignInitialized,
    peerSentryConfigured: input.peerSentryConfigured,
    timeSyncHealthy: input.timeSyncHealthy,
    storageHealthy: input.storageHealthy,
    operatorAcknowledged,
    genesisHashAcknowledged: input.operatorAcknowledgedHash,
    ready: failureCode === null,
    failureCode,
  });
}

export function sevenRehearsalValidatorReadiness(
  plan: ProductionLaunchPlan,
  dossiers: readonly ProductionValidatorDossier[],
): readonly LaunchValidatorReadiness[] {
  return Object.freeze(
    dossiers.map((dossier) =>
      evaluateValidatorReadiness({
        plan,
        dossier,
        observedGenesisHash: plan.genesisHash,
        observedCandidateHash: plan.candidateV2Hash,
        observedNetworkId: plan.networkId,
        observedChainId: plan.chainId,
        remoteSignerHealthy: true,
        antiDoubleSignInitialized: true,
        peerSentryConfigured: true,
        timeSyncHealthy: true,
        storageHealthy: true,
        operatorAcknowledgedHash: plan.genesisHash,
        consensusPublicKey: dossier.consensusPublicKeyDescriptor,
        artifactHash: plan.genesisHash,
      }),
    ),
  );
}

export function defaultServiceReadiness(broughtUp: boolean): readonly LaunchServiceReadiness[] {
  const sequenced = SERVICE_BRING_UP_SEQUENCE.map((step) =>
    Object.freeze({
      step,
      sequenced: true,
      independentlyGated: false,
      broughtUp,
      healthy: broughtUp,
    }),
  );
  const gated = INDEPENDENTLY_GATED_SERVICES.map((step) =>
    Object.freeze({
      step,
      sequenced: false,
      independentlyGated: true,
      broughtUp: false,
      healthy: true,
    }),
  );
  return Object.freeze([...sequenced, ...gated]);
}

export function rehearsalObservability(): LaunchObservabilityReadiness {
  return Object.freeze({
    metrics: true,
    logs: true,
    alerts: true,
    validatorHealth: true,
    signerHealth: true,
    disk: true,
    database: true,
    backupMonitoring: true,
    ready: true,
  });
}

export function rehearsalBackup(): LaunchBackupReadiness {
  return Object.freeze({
    backupTargetsConfigured: true,
    evidencePathsConfigured: true,
    ready: true,
  });
}

export function genesisDistributionHash(genesisBytesHex: string, validatorId: string): string {
  return digestText('SUNREY_GENESIS_DISTRIBUTION_V1', genesisBytesHex, validatorId);
}

export function independentlyVerifyDistributedGenesis(
  expectedHash: string,
  observedHash: string,
): boolean {
  return expectedHash === observedHash && /^[0-9a-f]{64}$/.test(observedHash);
}

export function validatorSetHashFromKeys(keys: readonly string[]): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.gex.validator-set.v1'), ...keys.map((key) => encodeString(key))]));
}
