/**
 * Canonical wallet transaction builder.
 *
 * Builds Chunk 32R protocol envelopes. Does not post journals or invent
 * a second native-asset ledger. Fee quotes distinguish estimated,
 * maximum authorized, and actual finalized fees.
 */

import { createHash } from 'node:crypto';

import {
  PROTOCOL_CHAIN_ID,
  PROTOCOL_CODEC_ID,
  PROTOCOL_NETWORK_ID,
  PROTOCOL_SCHEMA_VERSION,
} from '../protocol/constants.ts';
import type { ActorDescriptor } from '../protocol/actor.ts';
import type { EnvelopeV1, NativeAssetBody, ReservedBody, TransactionBodyV1 } from '../protocol/envelope.ts';
import type { NativeAssetId } from '../protocol/assets.ts';
import type { TransactionFamily } from '../protocol/transaction-family.ts';
import { fixtureHeader, fixtureObject, fixtureQuantity, fixtureRight } from '../protocol/fixtures.ts';
import { developmentFeeSchedule, hashFeeSchedule } from '../fees/schedule.ts';
import { estimateFee } from '../fees/engine.ts';
import { usageForOperation } from '../fees/meter.ts';
import type { ProtocolOperation } from '../fees/types.ts';
import type { BlockchainAccount, BuiltTransaction, FeeQuote, WalletRejection } from './types.ts';
import { parseAddress } from './address.ts';

export type BuildTransferInput = {
  readonly account: BlockchainAccount;
  readonly actor: ActorDescriptor;
  readonly toAccountId: string;
  readonly toAddressText: string;
  readonly assetId: NativeAssetId;
  readonly amount: bigint;
  readonly maxFee: bigint;
  readonly nonce: bigint;
  readonly purpose?: string;
  readonly encodedBytes?: number;
  readonly signatureCount?: number;
  readonly networkId?: string;
  readonly chainId?: string;
};

function bodyHashOf(body: TransactionBodyV1, networkId: string, chainId: string): string {
  return createHash('sha256')
    .update('SUNREY_TX_V1')
    .update(networkId)
    .update(chainId)
    .update(JSON.stringify({
      family: body.family,
      clientTxId: body.header.clientTxId,
      sequence: body.header.sequence.toString(),
      purpose: body.header.purpose,
    }))
    .digest('hex');
}

function quoteFee(operation: ProtocolOperation, encodedBytes: number, signatureCount: number, maxFee: bigint): FeeQuote {
  const usage = usageForOperation(operation, encodedBytes, signatureCount);
  const schedule = developmentFeeSchedule();
  const estimated = estimateFee(schedule, usage).estimatedFee;
  return Object.freeze({
    estimatedFee: estimated,
    maximumAuthorizedFee: maxFee,
    actualFinalizedFee: null,
    feeAsset: 'SUNREY_COIN',
    scheduleHash: hashFeeSchedule(schedule),
  });
}

export function buildNativeTransfer(input: BuildTransferInput): BuiltTransaction | WalletRejection {
  const networkId = input.networkId ?? PROTOCOL_NETWORK_ID;
  const chainId = input.chainId ?? PROTOCOL_CHAIN_ID;
  if (input.account.address.networkId !== networkId && input.account.address.networkClass === 'RESERVED_PRODUCTION') {
    return { ok: false, code: 'WRONG_CHAIN_TRANSACTION', detail: 'account network does not match the transaction network' };
  }
  const parsed = parseAddress(input.toAddressText, networkId);
  if (!parsed.ok) {
    return { ok: false, code: parsed.code === 'CHECKSUM_FAILURE' ? 'CHECKSUM_FAILURE' : 'WRONG_NETWORK_ADDRESS', detail: parsed.detail };
  }
  if (networkId !== PROTOCOL_NETWORK_ID && networkId !== 'net_sunrey_local_dev') {
    return { ok: false, code: 'WRONG_CHAIN_TRANSACTION', detail: 'wallet builder refuses unknown chain ids' };
  }
  const fee = quoteFee('NATIVE_TRANSFER', input.encodedBytes ?? 256, input.signatureCount ?? 1, input.maxFee);
  if (input.maxFee < fee.estimatedFee) {
    return { ok: false, code: 'INSUFFICIENT_BALANCE', detail: 'max_fee is below the estimated fee' };
  }
  const clientTxId = `client.tx.${input.account.accountId}.${input.nonce.toString()}`;
  const body: NativeAssetBody = Object.freeze({
    family: 'NATIVE_ASSET',
    header: fixtureHeader({
      clientTxId,
      actor: input.actor,
      sequence: input.nonce,
      idempotencyKey: `idem.${clientTxId}`,
      purpose: input.purpose ?? 'sunrey.native-asset.transfer',
    }),
    economicObject: fixtureObject({ subjectRef: input.account.accountId, quantity: fixtureQuantity(input.amount, input.assetId) }),
    rightsExercised: Object.freeze([fixtureRight({ subjectId: input.account.ownerActorId, holderId: input.account.ownerActorId })]),
    amount: fixtureQuantity(input.amount, input.assetId),
    fee: fixtureQuantity(input.maxFee, 'SUNREY_COIN'),
    operation: 'TRANSFER',
    counterpartyActorId: input.toAccountId,
    executionConditions: '',
    evidenceRequirements: Object.freeze(['evidence.settlement-anchor']),
  });
  const envelope: EnvelopeV1 = Object.freeze({
    networkId,
    chainId,
    codecId: PROTOCOL_CODEC_ID,
    schemaVersion: PROTOCOL_SCHEMA_VERSION,
    transactionType: 'NATIVE_ASSET',
    body,
    authentication: Object.freeze({
      schemaVersion: 1 as const,
      algorithmId: 1 as const,
      publicKey: new Uint8Array(32),
      signature: new Uint8Array(0),
      keyVersion: 1,
    }),
  });
  const hash = bodyHashOf(body, networkId, chainId);
  return Object.freeze({
    clientTxId,
    networkId,
    chainId,
    family: 'NATIVE_ASSET',
    accountId: input.account.accountId,
    counterpartyAccountId: input.toAccountId,
    assetId: input.assetId,
    amount: input.amount,
    fee,
    nonce: input.nonce,
    bodyHash: hash,
    unsignedEnvelope: envelope,
    signBytesHex: hash,
  });
}

export function buildLockUnlock(input: BuildTransferInput & { readonly operation: 'LOCK' | 'UNLOCK' }): BuiltTransaction | WalletRejection {
  const built = buildNativeTransfer(input);
  if ('ok' in built && built.ok === false) {
    return built;
  }
  return Object.freeze({
    ...built,
    family: 'NATIVE_ASSET' as TransactionFamily,
  });
}

export function buildReservedFamily(input: {
  readonly account: BlockchainAccount;
  readonly actor: ActorDescriptor;
  readonly family: 'ORACLE' | 'GOVERNANCE' | 'MACHINE_COMMERCE';
  readonly nonce: bigint;
  readonly maxFee: bigint;
  readonly purpose: string;
}): BuiltTransaction {
  const networkId = input.account.address.networkId;
  const chainId = PROTOCOL_CHAIN_ID;
  const clientTxId = `client.tx.${input.family.toLowerCase()}.${input.nonce.toString()}`;
  const body: ReservedBody = Object.freeze({
    family: input.family === 'MACHINE_COMMERCE' ? 'SYSTEM' : input.family,
    header: fixtureHeader({
      clientTxId,
      actor: input.actor,
      sequence: input.nonce,
      purpose: input.purpose,
    }),
  });
  const hash = bodyHashOf(body, networkId, chainId);
  const operation = input.family === 'GOVERNANCE' ? 'GOVERNANCE_SIGNATURE_VERIFY' : 'ORDINARY_STATE_WRITE';
  return Object.freeze({
    clientTxId,
    networkId,
    chainId,
    family: input.family,
    accountId: input.account.accountId,
    counterpartyAccountId: null,
    assetId: null,
    amount: null,
    fee: quoteFee(operation, 128, 1, input.maxFee),
    nonce: input.nonce,
    bodyHash: hash,
    unsignedEnvelope: Object.freeze({
      networkId,
      chainId,
      codecId: PROTOCOL_CODEC_ID,
      schemaVersion: PROTOCOL_SCHEMA_VERSION,
      transactionType: input.family,
      body,
    }),
    signBytesHex: hash,
  });
}
