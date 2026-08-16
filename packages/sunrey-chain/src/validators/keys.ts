import {
  FORBIDDEN_CONSENSUS_KEY_PURPOSES,
  type PublicKeyRef,
  type ValidatorRecord,
  type ValidatorResult,
  validatorErr,
  validatorOk,
} from './types.ts';

const ROLE_PURPOSE: Readonly<Record<PublicKeyRef['role'], string>> = {
  CONSENSUS_VOTING_KEY: 'VALIDATOR_CONSENSUS_SIGNING',
  P2P_NODE_KEY: 'P2P_IDENTITY',
  GOVERNANCE_KEY: 'GOVERNANCE_SIGNING',
  RECOVERY_KEY: 'ATTESTATION_SIGNING',
  REWARD_ADDRESS: 'WALLET_SIGNING',
};

export function assertConsensusKeyPurpose(purpose: string): ValidatorResult<true> {
  if ((FORBIDDEN_CONSENSUS_KEY_PURPOSES as readonly string[]).includes(purpose)) {
    return validatorErr(
      'FORBIDDEN_KEY_PURPOSE',
      `${purpose} cannot be a validator consensus voting key`,
    );
  }
  if (purpose !== 'VALIDATOR_CONSENSUS_SIGNING') {
    return validatorErr('KEY_ROLE_MISMATCH', `consensus key purpose must be VALIDATOR_CONSENSUS_SIGNING`);
  }
  return validatorOk(true);
}

export function assertKeyRole(ref: PublicKeyRef): ValidatorResult<true> {
  const expected = ROLE_PURPOSE[ref.role];
  if (ref.purpose !== expected) {
    return validatorErr('KEY_ROLE_MISMATCH', `${ref.role} requires purpose ${expected}`);
  }
  if (ref.role === 'CONSENSUS_VOTING_KEY') {
    return assertConsensusKeyPurpose(ref.purpose);
  }
  return validatorOk(true);
}

export function assertSeparatedRecordKeys(record: ValidatorRecord): ValidatorResult<true> {
  for (const ref of [
    record.consensusPublicKey,
    record.p2pPublicKey,
    record.governancePublicKey,
    record.recoveryKeyRef,
  ]) {
    const role = assertKeyRole(ref);
    if (!role.ok) {
      return role;
    }
  }
  const ids = [
    record.consensusPublicKey.keyId,
    record.p2pPublicKey.keyId,
    record.governancePublicKey.keyId,
    record.recoveryKeyRef.keyId,
  ];
  if (new Set(ids).size !== ids.length) {
    return validatorErr('UNIVERSAL_VALIDATOR_KEY', 'validator keys must be distinct; no universal validator key');
  }
  const pubs = [
    record.consensusPublicKey.publicKeyHex,
    record.p2pPublicKey.publicKeyHex,
    record.governancePublicKey.publicKeyHex,
    record.recoveryKeyRef.publicKeyHex,
  ];
  if (new Set(pubs).size !== pubs.length) {
    return validatorErr('UNIVERSAL_VALIDATOR_KEY', 'validator public keys must be distinct');
  }
  if ('privateKey' in record || 'private_key' in record) {
    return validatorErr('PRIVATE_KEY_IN_RECORD', 'ValidatorRecord must not contain private keys');
  }
  return validatorOk(true);
}

export function assertNoDuplicateConsensusKeys(records: readonly ValidatorRecord[]): ValidatorResult<true> {
  const seen = new Set<string>();
  for (const record of records) {
    if (record.status === 'EXITED' || record.status === 'TOMBSTONED') {
      continue;
    }
    const hex = record.consensusPublicKey.publicKeyHex;
    if (seen.has(hex)) {
      return validatorErr('DUPLICATE_CONSENSUS_KEY', `duplicate active consensus public key ${hex}`);
    }
    seen.add(hex);
  }
  return validatorOk(true);
}
