/**
 * Seven-validator testnet profile and CI fixture.
 *
 * Equal voting power unless configuration specifies another distribution.
 * No public staking. Admission remains governed/accountable.
 * Fixture keys are unmistakably test-only.
 */

import {
  createEd25519SignatureProvider,
  SUITE_SUNREY_ED25519_V1,
  type KeyPurpose,
} from '../../../security/src/index.ts';
import { sha256Bytes } from '../validators/canonical.ts';
import {
  TESTNET_VALIDATOR_LABELS,
  type TestnetGovernancePolicy,
  type TestnetValidatorLabel,
  type TestnetValidatorPublic,
} from './types.ts';
import { assertFixtureEnvironment, assertFixtureLabel, FIXTURE_KEY_MARKER } from './security.ts';

export const TESTNET_VALIDATOR_COUNT = 7 as const;
export const TESTNET_EQUAL_VOTING_POWER = 1n;
export const TESTNET_BFT_QUORUM_POWER = 5n;
export const TESTNET_CRYPTO_SUITE = SUITE_SUNREY_ED25519_V1;

const ROLE_LABEL = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
} as const;

export function fixtureKeyLabel(validator: TestnetValidatorLabel, role: keyof typeof ROLE_LABEL): string {
  const label = `SUNREY_TESTNET_1_FIXTURE_VALIDATOR_${validator}_${ROLE_LABEL[role]}_${FIXTURE_KEY_MARKER}_v1`;
  assertFixtureLabel(label);
  return label;
}

export function faucetAuthorityLabel(): string {
  const label = `SUNREY_TESTNET_1_FAUCET_AUTHORITY_${FIXTURE_KEY_MARKER}_v1`;
  assertFixtureLabel(label);
  return label;
}

export function fixtureSeedFromLabel(label: string): Buffer {
  assertFixtureLabel(label);
  assertFixtureEnvironment();
  return sha256Bytes(Buffer.from(label, 'utf8'));
}

function publicKeyFromLabel(
  validator: TestnetValidatorLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
): { readonly publicKeyHex: string; readonly keyId: string } {
  const provider = createEd25519SignatureProvider();
  const label = fixtureKeyLabel(validator, role);
  const seed = fixtureSeedFromLabel(label);
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `testnet-fixture:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return {
    publicKeyHex: derived.value.publicKey.publicKeyHex,
    keyId: derived.value.publicKey.keyId,
  };
}

export function faucetAuthorityPublicKey(): { readonly publicKeyHex: string; readonly keyId: string } {
  const provider = createEd25519SignatureProvider();
  const label = faucetAuthorityLabel();
  const seed = fixtureSeedFromLabel(label);
  const derived = provider.fromSeed(
    seed.toString('hex'),
    'ATTESTATION_SIGNING',
    SUITE_SUNREY_ED25519_V1,
    'testnet-fixture:faucet',
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return {
    publicKeyHex: derived.value.publicKey.publicKeyHex,
    keyId: derived.value.publicKey.keyId,
  };
}

export function sevenValidatorFixture(env: NodeJS.ProcessEnv = process.env): readonly TestnetValidatorPublic[] {
  assertFixtureEnvironment(env);
  return TESTNET_VALIDATOR_LABELS.map((label) =>
    Object.freeze({
      validatorId: `val_testnet_1_${label.toLowerCase()}`,
      operatorId: `operator.testnet.1.${label.toLowerCase()}`,
      consensusPublicKeyHex: publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING').publicKeyHex,
      p2pPublicKeyHex: publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY').publicKeyHex,
      governancePublicKeyHex: publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING').publicKeyHex,
      cryptoSuite: TESTNET_CRYPTO_SUITE,
      votingPower: TESTNET_EQUAL_VOTING_POWER,
    }),
  );
}

export function testnetGovernancePolicy(validators: readonly TestnetValidatorPublic[] = sevenValidatorFixture()): TestnetGovernancePolicy {
  const total = validators.reduce((sum, row) => sum + row.votingPower, 0n);
  const required = (total * 2n) / 3n + 1n;
  return Object.freeze({
    version: 1,
    thresholdModel: 'VALIDATOR_SUPERMAJORITY',
    requiredPower: required,
    totalPower: total,
    minActivationLead: 4,
    automaticBinaryUpgrade: false,
  });
}

export function bftQuorumSatisfied(onlinePower: bigint, totalPower: bigint): boolean {
  if (totalPower <= 0n) {
    return false;
  }
  return onlinePower * 3n > totalPower * 2n;
}

export function fixtureSecretsRejectedOutsideFixtureEnv(env: NodeJS.ProcessEnv): boolean {
  try {
    sevenValidatorFixture(env);
    return false;
  } catch {
    return true;
  }
}
