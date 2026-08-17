/**
 * Genesis ceremony: operators generate keys locally and contribute
 * only public descriptors. The coordinator never collects private keys.
 */

import { createHash } from 'node:crypto';

import { encodeString, encodeU64, sha256Hex } from '../validators/canonical.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from './identity.ts';
import { sevenValidatorFixture } from './validators.ts';
import type { CeremonyArtifact, CeremonyContribution, TestnetValidatorPublic } from './types.ts';

export const CEREMONY_DOMAIN = 'SUNREY_TESTNET_CEREMONY_V1' as const;

export function contributionHash(row: Omit<CeremonyContribution, 'submissionHash' | 'approved' | 'approvedBy'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(CEREMONY_DOMAIN),
      encodeString(row.validatorId),
      encodeString(row.operatorId),
      encodeString(row.consensusPublicKeyHex),
      encodeString(row.p2pPublicKeyHex),
      encodeString(row.governancePublicKeyHex),
      encodeString(row.cryptoSuite),
      encodeU64(row.votingPower),
    ]),
  );
}

export function contributePublicDescriptor(row: TestnetValidatorPublic, approvedBy = 'ceremony.coordinator'): CeremonyContribution {
  const base = {
    validatorId: row.validatorId,
    operatorId: row.operatorId,
    consensusPublicKeyHex: row.consensusPublicKeyHex,
    p2pPublicKeyHex: row.p2pPublicKeyHex,
    governancePublicKeyHex: row.governancePublicKeyHex,
    cryptoSuite: row.cryptoSuite,
    votingPower: row.votingPower,
  };
  return Object.freeze({
    ...base,
    submissionHash: contributionHash(base),
    approved: true,
    approvedBy,
  });
}

export function buildCeremonyArtifact(
  validators: readonly TestnetValidatorPublic[] = sevenValidatorFixture(),
): CeremonyArtifact {
  return Object.freeze({
    networkId: SUNREY_TESTNET_1_NETWORK_ID,
    chainId: SUNREY_TESTNET_1_CHAIN_ID,
    contributions: validators.map((row) => contributePublicDescriptor(row)),
    coordinatorCollectedPrivateKeys: false,
  });
}

export function ceremonyContainsPrivateMaterial(
  artifact: CeremonyArtifact,
  raw = JSON.stringify(artifact, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
): boolean {
  return (
    artifact.coordinatorCollectedPrivateKeys ||
    /privateKey|private_key|seedPhrase|BEGIN .*PRIVATE KEY/.test(raw)
  );
}

export function localOperatorDescriptor(label: string): {
  readonly validatorId: string;
  readonly publicOnly: true;
  readonly digest: string;
} {
  return {
    validatorId: `val_operator_${label}`,
    publicOnly: true,
    digest: createHash('sha256').update(`public-only:${label}`).digest('hex'),
  };
}
