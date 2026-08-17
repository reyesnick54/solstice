/**
 * Transaction builders. Construct canonical protocol bytes locally.
 * Signing is injected. Keys never go to public RPC.
 */

import { buildLockUnlock, buildNativeTransfer, buildReservedFamily } from '../../sunrey-chain/src/wallet/builder.ts';
import type { BlockchainAccount, BuiltTransaction, WalletRejection } from '../../sunrey-chain/src/wallet/index.ts';
import { isWalletRejection } from '../../sunrey-chain/src/wallet/types.ts';
import type { ActorDescriptor } from '../../sunrey-chain/src/protocol/actor.ts';
import type { NativeAssetId } from '../../sunrey-chain/src/protocol/assets.ts';
import { encodeUnsignedEnvelope, transactionIdOf, type EnvelopeV1 } from '../../sunrey-chain/src/protocol/index.ts';
import { PUBLIC_CHAIN_ID, PUBLIC_NETWORK_ID } from './ids.ts';
import type { FeeDeclaration } from './types.ts';

export type BuiltPublicTransaction = {
  readonly transaction_id: string;
  readonly client_tx_id: string;
  readonly network_id: string;
  readonly chain_id: string;
  readonly family: string;
  readonly unsigned_envelope_hex: string;
  readonly sign_bytes_hex: string;
  readonly fee: FeeDeclaration;
  readonly built: BuiltTransaction;
};

function toPublic(built: BuiltTransaction): BuiltPublicTransaction {
  const unsigned = encodeUnsignedEnvelope(built.unsignedEnvelope as EnvelopeV1);
  return Object.freeze({
    transaction_id: transactionIdOf(built.unsignedEnvelope as EnvelopeV1),
    client_tx_id: built.clientTxId,
    network_id: built.networkId,
    chain_id: built.chainId,
    family: built.family,
    unsigned_envelope_hex: Buffer.from(unsigned).toString('hex'),
    sign_bytes_hex: built.signBytesHex,
    fee: {
      estimatedFee: built.fee.estimatedFee.toString(),
      maximumAuthorizedFee: built.fee.maximumAuthorizedFee.toString(),
      actualFinalizedFee: built.fee.actualFinalizedFee === null ? null : built.fee.actualFinalizedFee.toString(),
      feeAsset: built.fee.feeAsset,
      scheduleHash: built.fee.scheduleHash,
    },
    built,
  });
}

function actorOf(account: BlockchainAccount): ActorDescriptor {
  return Object.freeze({
    schemaVersion: 1,
    actorId: account.ownerActorId,
    actorType: account.accountType === 'MACHINE_ACCOUNT' ? 'ROBOT' : 'HUMAN',
    ownerControllerId: account.ownerActorId,
    credentialRefs: Object.freeze([`cred.${account.ownerActorId}`]),
    capabilityRefs: Object.freeze([] as string[]),
    modelFirmwareRef: '',
    jurisdiction: 'SIM-DEV',
    revocationState: 'ACTIVE',
    identitySystemRef: 'solstice.identity',
  });
}

function reject(result: BuiltTransaction | WalletRejection): BuiltPublicTransaction {
  if (isWalletRejection(result)) {
    throw new Error(result.code);
  }
  return toPublic(result);
}

export function buildNativeAssetTransfer(input: {
  readonly account: BlockchainAccount;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly nonce: bigint;
  readonly assetId?: NativeAssetId;
  readonly purpose?: string;
}): BuiltPublicTransaction {
  return reject(
    buildNativeTransfer({
      account: input.account,
      actor: actorOf(input.account),
      toAccountId: input.toAccountId,
      toAddressText: input.toAddressText,
      assetId: input.assetId ?? 'SUNREY_COIN',
      amount: input.amount,
      maxFee: input.maxFee,
      nonce: input.nonce,
      networkId: input.account.address.networkId || PUBLIC_NETWORK_ID,
      chainId: PUBLIC_CHAIN_ID,
      ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
    }),
  );
}

export function buildAssetLock(input: {
  readonly account: BlockchainAccount;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly nonce: bigint;
}): BuiltPublicTransaction {
  return reject(
    buildLockUnlock({
      account: input.account,
      actor: actorOf(input.account),
      toAccountId: input.toAccountId,
      toAddressText: input.toAddressText,
      assetId: 'SUNREY_COIN',
      amount: input.amount,
      maxFee: input.maxFee,
      nonce: input.nonce,
      operation: 'LOCK',
    }),
  );
}

export function buildAssetUnlock(input: {
  readonly account: BlockchainAccount;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly nonce: bigint;
}): BuiltPublicTransaction {
  return reject(
    buildLockUnlock({
      account: input.account,
      actor: actorOf(input.account),
      toAccountId: input.toAccountId,
      toAddressText: input.toAddressText,
      assetId: 'SUNREY_COIN',
      amount: input.amount,
      maxFee: input.maxFee,
      nonce: input.nonce,
      operation: 'UNLOCK',
    }),
  );
}

export function buildMachineCommerce(input: {
  readonly account: BlockchainAccount;
  readonly nonce: bigint;
  readonly maxFee: bigint;
}): BuiltPublicTransaction {
  return toPublic(
    buildReservedFamily({
      account: input.account,
      actor: actorOf(input.account),
      family: 'MACHINE_COMMERCE',
      nonce: input.nonce,
      maxFee: input.maxFee,
      purpose: 'sunrey.machine.commerce',
    }),
  );
}

export function buildOracleObservation(input: {
  readonly account: BlockchainAccount;
  readonly nonce: bigint;
  readonly maxFee: bigint;
}): BuiltPublicTransaction {
  return toPublic(
    buildReservedFamily({
      account: input.account,
      actor: actorOf(input.account),
      family: 'ORACLE',
      nonce: input.nonce,
      maxFee: input.maxFee,
      purpose: 'sunrey.oracle.observation',
    }),
  );
}

export function buildProductiveClaim(input: {
  readonly account: BlockchainAccount;
  readonly nonce: bigint;
  readonly maxFee: bigint;
}): BuiltPublicTransaction {
  return toPublic(
    buildReservedFamily({
      account: input.account,
      actor: actorOf(input.account),
      family: 'ORACLE',
      nonce: input.nonce,
      maxFee: input.maxFee,
      purpose: 'sunrey.productive.claim',
    }),
  );
}

export function buildGovernanceVote(input: {
  readonly account: BlockchainAccount;
  readonly nonce: bigint;
  readonly maxFee: bigint;
}): BuiltPublicTransaction {
  return toPublic(
    buildReservedFamily({
      account: input.account,
      actor: actorOf(input.account),
      family: 'GOVERNANCE',
      nonce: input.nonce,
      maxFee: input.maxFee,
      purpose: 'sunrey.governance.vote',
    }),
  );
}

export function buildInterchainPacket(input: {
  readonly account: BlockchainAccount;
  readonly nonce: bigint;
  readonly maxFee: bigint;
}): BuiltPublicTransaction {
  return toPublic(
    buildReservedFamily({
      account: input.account,
      actor: actorOf(input.account),
      family: 'MACHINE_COMMERCE',
      nonce: input.nonce,
      maxFee: input.maxFee,
      purpose: 'sunrey.interop.packet',
    }),
  );
}
