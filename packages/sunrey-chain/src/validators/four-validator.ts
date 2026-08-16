import {
  createDefaultCryptoSuiteRegistry,
  createEd25519SignatureProvider,
  createSecurityProviderCatalog,
  SUITE_SUNREY_ED25519_V1,
  type KeyPurpose,
} from '../../../security/src/index.ts';
import { sha256Bytes } from './canonical.ts';
import { freezeValidatorSet, validatorSetHash } from './set.ts';
import {
  CANONICAL_VALIDATOR_SUITE_ID,
  type PublicKeyRef,
  type ValidatorRecord,
  type ValidatorSet,
  simulationBond,
} from './types.ts';

export const FOUR_VALIDATOR_LABELS = ['A', 'B', 'C', 'D'] as const;
export type FourValidatorLabel = (typeof FOUR_VALIDATOR_LABELS)[number];

const ROLE_LABEL: Readonly<Record<'consensus' | 'p2p' | 'governance' | 'recovery', string>> = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
  recovery: 'RECOVERY',
};

export function developmentKeyLabel(validator: FourValidatorLabel, role: keyof typeof ROLE_LABEL): string {
  return `SUNREY_DEV_VALIDATOR_${validator}_${ROLE_LABEL[role]}_NOT_FOR_PRODUCTION_v1`;
}

export function developmentSeedFromLabel(label: string): Buffer {
  return sha256Bytes(Buffer.from(label, 'utf8'));
}

function publicKeyFromLabel(
  validator: FourValidatorLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
  keyRole: PublicKeyRef['role'],
): PublicKeyRef {
  const provider = createEd25519SignatureProvider();
  const label = developmentKeyLabel(validator, role);
  const seed = developmentSeedFromLabel(label);
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `dev:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return Object.freeze({
    role: keyRole,
    purpose,
    publicKeyHex: derived.value.publicKey.publicKeyHex,
    keyId: derived.value.publicKey.keyId,
    suiteId: CANONICAL_VALIDATOR_SUITE_ID,
  });
}

export function developmentValidatorRecord(label: FourValidatorLabel, height = 0n): ValidatorRecord {
  return Object.freeze({
    validatorId: `val_dev_${label.toLowerCase()}`,
    operatorActorId: `actor.human.operator.${label.toLowerCase()}`,
    controllerKind: 'HUMAN',
    legalEntityRef: `le.dev.validator.${label.toLowerCase()}`,
    consensusPublicKey: publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING', 'CONSENSUS_VOTING_KEY'),
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
    p2pNodeId: `node_dev_${label.toLowerCase()}`,
    p2pPublicKey: publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY', 'P2P_NODE_KEY'),
    governancePublicKey: publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING', 'GOVERNANCE_KEY'),
    recoveryKeyRef: publicKeyFromLabel(label, 'recovery', 'ATTESTATION_SIGNING', 'RECOVERY_KEY'),
    rewardAddress: null,
    bondDescriptor: simulationBond(1n),
    votingPower: 1n,
    status: 'ACTIVE',
    activationEpoch: 0n,
    exitEpoch: null,
    jurisdictionMetadata: 'SIM:DEV',
    protocolMetadata: 'chunk-36-four-validator-devset',
    createdHeight: height,
    updatedHeight: height,
    schemaVersion: 1,
    historicalConsensusKeys: Object.freeze([]),
  });
}

export function fourValidatorDevelopmentSet(version = 1n, epoch = 0n): ValidatorSet {
  const registry = createDefaultCryptoSuiteRegistry();
  const catalog = createSecurityProviderCatalog();
  if (!registry.get(SUITE_SUNREY_ED25519_V1).ok || !catalog.signature('Ed25519').ok) {
    throw new Error('canonical validator suite is not registered');
  }
  return freezeValidatorSet({
    version,
    epoch,
    validators: FOUR_VALIDATOR_LABELS.map((label) => developmentValidatorRecord(label)),
  });
}

export function fourValidatorDevelopmentHash(): string {
  return validatorSetHash(fourValidatorDevelopmentSet());
}

export function fourValidatorPublicView(set: ValidatorSet = fourValidatorDevelopmentSet()): {
  readonly validatorSetVersion: string;
  readonly validatorSetHash: string;
  readonly validators: readonly {
    readonly validatorId: string;
    readonly consensusPublicKey: string;
    readonly p2pNodeId: string;
    readonly votingPower: string;
    readonly status: string;
  }[];
} {
  return {
    validatorSetVersion: set.version.toString(),
    validatorSetHash: validatorSetHash(set),
    validators: set.validators.map((row) => ({
      validatorId: row.validatorId,
      consensusPublicKey: row.consensusPublicKey.publicKeyHex,
      p2pNodeId: row.p2pNodeId,
      votingPower: row.votingPower.toString(),
      status: row.status,
    })),
  };
}
